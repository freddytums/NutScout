import {
  collection,
  doc,
  setDoc,
  getDocs,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { useTBAStore } from '@/store/tbaStore';
import type { EventConfig } from '@/types/scout';

// ─── Teams ───────────────────────────────────────────────────────────────────

const TEAMS = [
  254, 1678, 4414, 3310, 1323, 2910, 1619, 5026,
  2056, 148,  3538, 1114, 2767, 1241, 4910, 3015,
  604,  6328, 3360, 2522, 1086, 3476, 5987, 2658,
  2451, 1690, 7461, 2220, 4613, 3255, 1720, 6672,
  2468, 5190, 3314, 1477, 2169, 498,  8033, 5024,
];

// Skill 0-1 by team (higher-profile teams score more)
const SKILL: Record<number, number> = {
  254: 1.0, 1678: 0.95, 4414: 0.9, 2056: 0.88, 148: 0.85,
  604: 0.85, 6328: 0.82, 3310: 0.8, 1323: 0.78, 2910: 0.75,
};
const skill = (t: number) => SKILL[t] ?? 0.4 + (t % 7) * 0.06;

// Demo scout accounts (6 primary + 3 bench)
const SCOUTS = [
  { uid: 'demo-brando',  name: 'Brando'  },
  { uid: 'demo-kyle',    name: 'Kyle'    },
  { uid: 'demo-victor',  name: 'Victor'  },
  { uid: 'demo-jack',    name: 'Jack'    },
  { uid: 'demo-henry',   name: 'Henry'   },
  { uid: 'demo-walshie', name: 'Walshie' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

let seed = 42;
function rng() { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; }
function rInt(min: number, max: number) { return Math.floor(rng() * (max - min + 1)) + min; }
function rBool(prob: number) { return rng() < prob; }

function matchData(teamNum: number, matchNum: number) {
  const s = skill(teamNum);
  // One subtle outlier in match 22 for team 1678 — detectable but not absurd
  const isOutlier = teamNum === 1678 && matchNum === 22;
  const mult = isOutlier ? 1.8 : 1;

  return {
    auto_leave:          rBool(0.6 + s * 0.35),
    auto_coral_l1:       rInt(0, Math.round((1 + s) * mult)),
    auto_coral_l2:       rInt(0, Math.round((2 * s) * mult)),
    auto_coral_l3:       rInt(0, Math.round((1.5 * s) * mult)),
    auto_coral_l4:       rInt(0, Math.round((s) * mult)),
    auto_path:           [],
    teleop_coral_l1:     rInt(0, Math.round(4 * s * mult)),
    teleop_coral_l2:     rInt(0, Math.round(7 * s * mult)),
    teleop_coral_l3:     rInt(0, Math.round(5 * s * mult)),
    teleop_coral_l4:     rInt(0, Math.round(3 * s * mult)),
    teleop_algae_net:    rInt(0, Math.round(3 * s)),
    teleop_algae_processor: rInt(0, Math.round(2 * s)),
    teleop_defense_rating: rInt(0, s > 0.7 ? 1 : 3),
    teleop_driver_skill: rInt(Math.round(1 + s * 2), 5),
    endgame_climb:       s > 0.8 ? 'Deep Cage' : s > 0.6 ? 'Shallow Cage' : rBool(0.4) ? 'Park' : 'None',
    endgame_harmony:     rBool(s * 0.25),
    endgame_notes:       '',
  };
}

// ─── Qual schedule (50 matches, 6 robots each) ────────────────────────────────

function buildSchedule(): { matchNumber: number; red: number[]; blue: number[] }[] {
  const matches = [];
  // Each team appears ~7-8 times in 50 matches (40 teams × 7.5 ≈ 300 slots / 6 per match = 50)
  const pool = [...TEAMS, ...TEAMS, ...TEAMS, ...TEAMS, ...TEAMS, ...TEAMS, ...TEAMS];
  // Shuffle with seeded rng
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  for (let m = 0; m < 50; m++) {
    const offset = m * 6;
    const six = pool.slice(offset % pool.length, offset % pool.length + 6);
    // Pad if needed
    while (six.length < 6) six.push(TEAMS[six.length % TEAMS.length]);
    matches.push({ matchNumber: m + 1, red: six.slice(0, 3), blue: six.slice(3, 6) });
  }
  return matches;
}

// ─── Main seeder ─────────────────────────────────────────────────────────────

const EVENT_ID = 'demo-2026';
const COMPLETED_MATCHES = 25; // halfway through 50 quals
const NOW_UNIX = Math.floor(Date.now() / 1000);
const MATCH_INTERVAL = 8 * 60; // 8 minutes between matches

async function clearDemoEvent() {
  // Only matches need deletion — they use auto-generated IDs so re-seeding would stack.
  // Pits use deterministic team-number IDs and are overwritten by setDoc below.
  const snap = await getDocs(collection(db, 'events', EVENT_ID, 'matches'));
  if (snap.empty) return;
  let batch = writeBatch(db);
  let count = 0;
  for (const d of snap.docs) {
    batch.delete(d.ref);
    if (++count >= 400) { await batch.commit(); batch = writeBatch(db); count = 0; }
  }
  if (count > 0) await batch.commit();
}

export async function seedDemoEvent(): Promise<EventConfig> {
  seed = 42; // reset for determinism

  // ── Wipe previous demo data so re-seeding starts clean ─────────────────────
  await clearDemoEvent();

  // ── Event document ──────────────────────────────────────────────────────────
  const eventConfig: EventConfig = {
    id: EVENT_ID,
    name: '2026 Chezy Champs (Demo)',
    year: 2026,
    eventKey: EVENT_ID,
    pitLayout: {
      rows: 5,
      cols: 8,
      rowLabels: ['A', 'B', 'C', 'D', 'E'],
      colLabels: ['1', '2', '3', '4', '5', '6', '7', '8'],
    },
    teamAssignments: Object.fromEntries(
      TEAMS.map((t, i) => [`${Math.floor(i / 8)}-${i % 8}`, t])
    ),
    activeGameYear: 2026,
  };

  await setDoc(doc(db, 'events', EVENT_ID), eventConfig);

  const schedule = buildSchedule();

  // ── Pit entries (batched) ───────────────────────────────────────────────────
  // Row A + B: all scouted | Row C: half scouted half dibbed | Row D: mixed | Row E: unclaimed
  const pitBatch = writeBatch(db);
  TEAMS.forEach((team, i) => {
    const row = Math.floor(i / 8);
    let status: 'unclaimed' | 'dibbed' | 'scouted' = 'unclaimed';
    let dibbedBy: string | undefined;
    let dibbedByName: string | undefined;
    let scoutedBy: string | undefined;

    // Rows A–D fully scouted, row E: 6 scouted, 1 dibbed, 1 unclaimed
    if (row < 4) {
      status = 'scouted';
      scoutedBy = SCOUTS[i % 6].uid;
    } else {
      const col = i % 8;
      if (col < 6) { status = 'scouted'; scoutedBy = SCOUTS[col % 6].uid; }
      else if (col === 6) { status = 'dibbed'; dibbedBy = SCOUTS[2].uid; dibbedByName = SCOUTS[2].name; }
      // col === 7 stays unclaimed
    }

    pitBatch.set(doc(db, 'events', EVENT_ID, 'pits', String(team)), {
      teamNumber: team,
      row,
      col: i % 8,
      status,
      ...(dibbedBy ? { dibbedBy, dibbedByName, dibbedAt: Timestamp.now() } : {}),
      ...(scoutedBy ? { scoutedBy, scoutedAt: Timestamp.now() } : {}),
      createdAt: Timestamp.now(),
    });
  });
  await pitBatch.commit();

  // ── Match entries (batched, split at 400) ────────────────────────────────────
  const completedMatches = schedule.slice(0, COMPLETED_MATCHES);
  let batch = writeBatch(db);
  let batchCount = 0;

  for (const match of completedMatches) {
    const matchTime = NOW_UNIX - (COMPLETED_MATCHES - match.matchNumber + 1) * MATCH_INTERVAL;

    // One missed slot in match 20 (red3) — realistic scout gap
    const skipSlot = match.matchNumber === 20 ? 'red3' : null;

    const slots: { alliance: 'red' | 'blue'; position: 1 | 2 | 3; team: number; scout: typeof SCOUTS[0] }[] = [
      { alliance: 'red',  position: 1, team: match.red[0],  scout: SCOUTS[0] },
      { alliance: 'red',  position: 2, team: match.red[1],  scout: SCOUTS[1] },
      { alliance: 'red',  position: 3, team: match.red[2],  scout: SCOUTS[2] },
      { alliance: 'blue', position: 1, team: match.blue[0], scout: SCOUTS[3] },
      { alliance: 'blue', position: 2, team: match.blue[1], scout: SCOUTS[4] },
      { alliance: 'blue', position: 3, team: match.blue[2], scout: SCOUTS[5] },
    ];

    for (const slot of slots) {
      const slotKey = `${slot.alliance}${slot.position}`;
      if (slotKey === skipSlot) continue;

      const ref = doc(collection(db, 'events', EVENT_ID, 'matches'));
      batch.set(ref, {
        teamNumber: slot.team,
        matchNumber: match.matchNumber,
        matchType: 'qm',
        alliance: slot.alliance,
        alliancePosition: slot.position,
        scoutedBy: slot.scout.uid,
        scoutedByName: slot.scout.name,
        eventKey: EVENT_ID,
        year: 2026,
        timestamp: Timestamp.fromMillis(matchTime * 1000 + rInt(0, 120) * 1000),
        data: matchData(slot.team, match.matchNumber),
        flags: {},
        notes: '',
      });
      batchCount++;

      if (batchCount >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        batchCount = 0;
      }
    }
  }
  if (batchCount > 0) await batch.commit();

  // ── Station assignments ──────────────────────────────────────────────────────
  await setDoc(doc(db, 'events', EVENT_ID, 'meta', 'assignments'), {
    red1:  { uid: SCOUTS[0].uid, name: SCOUTS[0].name },
    red2:  { uid: SCOUTS[1].uid, name: SCOUTS[1].name },
    red3:  { uid: SCOUTS[2].uid, name: SCOUTS[2].name },
    blue1: { uid: SCOUTS[3].uid, name: SCOUTS[3].name },
    blue2: { uid: SCOUTS[4].uid, name: SCOUTS[4].name },
    blue3: { uid: SCOUTS[5].uid, name: SCOUTS[5].name },
  });

  // ── TBA store — seed with demo schedule so the quick-fill picker aligns ──────
  // Without this the picker either shows nothing or stale data from a different
  // event, so scoutedSet keys never match and cells never turn green.
  useTBAStore.getState().setTBAData(
    {
      key: EVENT_ID,
      name: eventConfig.name,
      short_name: 'Chezy Champs',
      event_code: 'demo',
      year: 2026,
      start_date: '2026-09-12',
      end_date: '2026-09-14',
      location_name: 'Demo Arena',
      city: 'San Jose',
      state_prov: 'CA',
      country: 'USA',
    },
    TEAMS.map((t) => ({
      key: `frc${t}`,
      team_number: t,
      nickname: `Team ${t}`,
      name: `FRC Team ${t}`,
      city: null,
      state_prov: null,
    })),
    schedule.map((m) => {
      const matchTime = NOW_UNIX - (COMPLETED_MATCHES - m.matchNumber + 1) * MATCH_INTERVAL;
      const played = m.matchNumber <= COMPLETED_MATCHES;
      return {
        key: `${EVENT_ID}_qm${m.matchNumber}`,
        comp_level: 'qm' as const,
        set_number: 1,
        match_number: m.matchNumber,
        alliances: {
          red:  { team_keys: m.red.map((t)  => `frc${t}`), score: -1, dq_team_keys: [], surrogate_team_keys: [] },
          blue: { team_keys: m.blue.map((t) => `frc${t}`), score: -1, dq_team_keys: [], surrogate_team_keys: [] },
        },
        time: matchTime,
        predicted_time: matchTime,
        actual_time: played ? matchTime : null,
        post_result_time: played ? matchTime + 60 : null,
      };
    })
  );

  return eventConfig;
}
