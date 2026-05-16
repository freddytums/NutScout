import type { GameConfig } from '../types/game';

// 2026 FRC Game: "REBUILT™ presented by Haas"
// Scoring summary:
//   FUEL in active HUB → 1 pt each (auto or teleop)
//   Auto Tower Level 1 → 15 pts (max 2 robots per alliance)
//   Teleop Tower Level 1 → 10 pts, Level 2 → 20 pts, Level 3 → 30 pts
//   ENERGIZED RP: ≥100 fuel in active HUB | SUPERCHARGED RP: ≥360 | TRAVERSAL RP: ≥50 tower pts
const game2026: GameConfig = {
  year: 2026,
  name: 'Rebuilt',
  season: '2025-2026',
  match: {
    // ── AUTO (20 seconds) ────────────────────────────────────────────────────
    auto: [
      {
        id: 'auto_leave',
        label: 'Left Starting Zone',
        type: 'toggle',
        section: 'auto',
        defaultValue: false,
        helpText: 'Robot moved out of the starting zone during auto',
      },
      {
        id: 'auto_failed',
        label: 'Auto Failed',
        type: 'toggle',
        section: 'auto',
        defaultValue: false,
        helpText: 'Robot did not execute auto routine as expected',
      },
      {
        id: 'auto_fuel',
        label: 'Fuel Scored in Hub',
        type: 'counter',
        section: 'auto',
        min: 0,
        defaultValue: 0,
        pointsPerUnit: 1,
        helpText: 'Each fuel scored in an active hub = 1 pt. More auto fuel = opponent hub goes inactive first.',
      },
      {
        id: 'auto_tower_l1',
        label: 'Tower Climb (Level 1)',
        type: 'toggle',
        section: 'auto',
        defaultValue: false,
        pointsPerUnit: 15,
        helpText: 'Robot no longer touching carpet/tower base. 15 pts. Max 2 robots per alliance.',
      },
      {
        id: 'auto_path',
        label: 'Autonomous Path',
        type: 'path',
        section: 'auto',
        helpText: "Draw the robot's autonomous path on the field",
      },
    ],

    // ── TELEOP (2 min 20 sec) ────────────────────────────────────────────────
    teleop: [
      {
        id: 'teleop_fuel',
        label: 'Fuel Scored in Hub',
        type: 'counter',
        section: 'teleop',
        min: 0,
        defaultValue: 0,
        pointsPerUnit: 1,
        helpText: 'Count fuel scored when this robot\'s hub is active. Shots in an inactive hub = 0 pts.',
      },
      {
        id: 'teleop_under_trench',
        label: 'Used Trench',
        type: 'toggle',
        section: 'teleop',
        defaultValue: false,
        helpText: 'Robot drove under the trench during teleop (robot height ≤ 22.25")',
      },
      {
        id: 'teleop_crossed_bump',
        label: 'Crossed Bump',
        type: 'toggle',
        section: 'teleop',
        defaultValue: false,
        helpText: 'Robot drove over the alliance bump',
      },
      {
        id: 'teleop_defense_rating',
        label: 'Defense Rating',
        type: 'rating',
        section: 'teleop',
        min: 0,
        max: 5,
        defaultValue: 0,
        helpText: '0 = no defense played, 5 = outstanding defense',
      },
      {
        id: 'teleop_driver_skill',
        label: 'Driver Skill',
        type: 'rating',
        section: 'teleop',
        min: 1,
        max: 5,
        defaultValue: 3,
      },
      {
        id: 'flag_defense',
        label: 'Played Defense',
        type: 'toggle',
        section: 'teleop',
        defaultValue: false,
      },
      {
        id: 'flag_passing',
        label: 'Passing / Assisted Partners',
        type: 'toggle',
        section: 'teleop',
        defaultValue: false,
        helpText: 'Robot distributed fuel to or assisted alliance partners',
      },
      {
        id: 'flag_penalties',
        label: 'Caused Penalties',
        type: 'toggle',
        section: 'teleop',
        defaultValue: false,
        helpText: 'Robot drew fouls / caused opponent to score extra points',
      },
      {
        id: 'flag_breakdown',
        label: 'Robot Broke Down',
        type: 'toggle',
        section: 'teleop',
        defaultValue: false,
      },
    ],

    // ── ENDGAME (last 30 seconds) ────────────────────────────────────────────
    endgame: [
      {
        id: 'endgame_tower_level',
        label: 'Tower Climb Level',
        type: 'select',
        section: 'endgame',
        options: ['None', 'Level 1', 'Level 2', 'Level 3'],
        defaultValue: 'None',
        helpText: 'L1 (above carpet/base)=10 pts · L2 (bumpers above low rung)=20 pts · L3 (bumpers above mid rung)=30 pts',
      },
      {
        id: 'endgame_notes',
        label: 'Endgame Notes',
        type: 'textarea',
        section: 'endgame',
      },
    ],
  },

  // ── PIT SCOUTING ──────────────────────────────────────────────────────────
  pit: [
    {
      id: 'pit_drivetrain',
      label: 'Drivetrain Type',
      type: 'select',
      section: 'general',
      options: ['Swerve', 'Tank', 'Mecanum', 'Other'],
      required: true,
    },
    {
      id: 'pit_height',
      label: 'Robot Height',
      type: 'select',
      section: 'general',
      options: ['Under 22.25" (fits trench)', '22.25"–48"', 'Over 48"'],
      required: true,
      helpText: 'Trench clearance is 22.25". Robots ≤22.25" can pass under the trench.',
    },
    {
      id: 'pit_fuel_capacity',
      label: 'Fuel Storage Capacity',
      type: 'counter',
      section: 'general',
      min: 0,
      max: 50,
      defaultValue: 0,
      helpText: 'Max number of fuel balls the robot can hold at once (up to 8 preloaded)',
    },
    {
      id: 'pit_can_shoot',
      label: 'Can Shoot into Hub?',
      type: 'toggle',
      section: 'general',
      defaultValue: true,
      helpText: 'Hub opening is at 72" height. Can robot shoot fuel into hub?',
    },
    {
      id: 'pit_shooting_range',
      label: 'Max Shooting Range',
      type: 'select',
      section: 'general',
      options: ['Under hub only', 'Mid range (~10ft)', 'Long range (>15ft)'],
      helpText: 'Effective shooting distance from hub',
    },
    {
      id: 'pit_turret',
      label: 'Has Turret?',
      type: 'toggle',
      section: 'general',
      defaultValue: false,
      helpText: 'Shooter can rotate/aim without turning the whole robot',
    },
    {
      id: 'pit_dumper',
      label: 'Has Dumper?',
      type: 'toggle',
      section: 'general',
      defaultValue: false,
      helpText: 'Can dump multiple fuel balls at once (vs. individual shooting)',
    },
    {
      id: 'pit_max_tower_level',
      label: 'Max Tower Level',
      type: 'select',
      section: 'general',
      options: ['None', 'Level 1', 'Level 2', 'Level 3'],
      required: true,
      helpText: 'Highest tower level robot can reliably achieve',
    },
    {
      id: 'pit_auto_fuel_count',
      label: 'Auto Fuel (Reliable)',
      type: 'counter',
      section: 'general',
      min: 0,
      max: 60,
      defaultValue: 0,
      helpText: 'How many fuel can they reliably score in auto?',
    },
    {
      id: 'pit_auto_count',
      label: 'Number of Auto Routines',
      type: 'counter',
      section: 'general',
      min: 0,
      max: 10,
      defaultValue: 0,
    },
    {
      id: 'pit_auto_description',
      label: 'Auto Description',
      type: 'textarea',
      section: 'general',
    },
    {
      id: 'pit_weight',
      label: 'Robot Weight (lbs)',
      type: 'counter',
      section: 'general',
      min: 0,
      max: 125,
      defaultValue: 0,
    },
    {
      id: 'pit_preferred_role',
      label: 'Preferred Role',
      type: 'select',
      section: 'general',
      options: ['Fuel Scorer', 'Tower Climber', 'Defender', 'Flexible'],
    },
    {
      id: 'pit_overall_impression',
      label: 'Overall Impression',
      type: 'rating',
      section: 'general',
      min: 1,
      max: 5,
      required: true,
    },
    {
      id: 'pit_notes',
      label: 'Additional Notes',
      type: 'textarea',
      section: 'general',
    },
  ],

  field: {
    src: '/NutScout/field-2026.png',
    widthFt: 54.27,  // 651.2 in
    heightFt: 26.47, // 317.7 in
  },
};

export default game2026;
