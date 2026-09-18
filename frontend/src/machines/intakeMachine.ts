import { setup, assign } from 'xstate';

export interface IntakeContext {
  clinic_mode: 'allopathic' | 'ayush';
  session_id: string;
  language: string;
  hasRedFlags: boolean;
}

export type IntakeEvent =
  | { type: 'NEXT' }
  | { type: 'PREV' }
  | { type: 'SET_CLINIC_MODE'; mode: 'allopathic' | 'ayush' }
  | { type: 'REDFLAG_DETECTED' }
  | { type: 'CLEAR_REDFLAG' }
  | { type: 'STAFF_ASSIST_REQUESTED' }
  | { type: 'STAFF_ASSIST_RESOLVED' };

export const intakeMachine = setup({
  types: {
    context: {} as IntakeContext,
    events: {} as IntakeEvent,
  },
  actions: {
    setClinicMode: assign({
      clinic_mode: ({ event }) => (event as any).mode,
    }),
    setRedFlag: assign({
      hasRedFlags: true,
    }),
    clearRedFlag: assign({
      hasRedFlags: false,
    }),
  },
  guards: {
    isAyushMode: ({ context }) => context.clinic_mode === 'ayush',
  },
}).createMachine({
  id: 'swasthyasync-intake',
  initial: 'INIT',
  context: {
    clinic_mode: 'allopathic',
    session_id: 'sess_' + Math.random().toString(36).substr(2, 9),
    language: 'en-IN',
    hasRedFlags: false,
  },
  on: {
    REDFLAG_DETECTED: {
      target: '.EMERGENCY_PROTOCOL',
      actions: 'setRedFlag',
    },
    STAFF_ASSIST_REQUESTED: {
      target: '.STAFF_ASSIST',
    },
  },
  states: {
    INIT: {
      on: {
        NEXT: 'AUTH_CONSENT',
        SET_CLINIC_MODE: {
          actions: 'setClinicMode',
        },
      },
    },
    AUTH_CONSENT: {
      on: {
        NEXT: 'CHIEF_COMPLAINT',
        PREV: 'INIT',
      },
    },
    CHIEF_COMPLAINT: {
      on: {
        NEXT: 'HPI',
        PREV: 'AUTH_CONSENT',
      },
    },
    HPI: {
      on: {
        NEXT: 'PMH',
        PREV: 'CHIEF_COMPLAINT',
      },
    },
    PMH: {
      on: {
        NEXT: 'PSH',
        PREV: 'HPI',
      },
    },
    PSH: {
      on: {
        NEXT: 'DRUG_ALLERGY',
        PREV: 'PMH',
      },
    },
    DRUG_ALLERGY: {
      on: {
        NEXT: 'FAMILY_HX',
        PREV: 'PSH',
      },
    },
    FAMILY_HX: {
      on: {
        NEXT: 'SOCIAL_HX',
        PREV: 'DRUG_ALLERGY',
      },
    },
    SOCIAL_HX: {
      on: {
        NEXT: 'ROS',
        PREV: 'FAMILY_HX',
      },
    },
    ROS: {
      on: {
        NEXT: [
          {
            guard: 'isAyushMode',
            target: 'AYUSH_ASSESSMENT',
          },
          {
            target: 'DOCUMENT_SCAN',
          },
        ],
        PREV: 'SOCIAL_HX',
      },
    },
    AYUSH_ASSESSMENT: {
      on: {
        NEXT: 'DOCUMENT_SCAN',
        PREV: 'ROS',
      },
    },
    DOCUMENT_SCAN: {
      on: {
        NEXT: 'SUMMARY_CONFIRMATION',
        PREV: [
          {
            guard: 'isAyushMode',
            target: 'AYUSH_ASSESSMENT',
          },
          {
            target: 'ROS',
          },
        ],
      },
    },
    SUMMARY_CONFIRMATION: {
      on: {
        NEXT: 'COMPLETE',
        PREV: 'DOCUMENT_SCAN',
      },
    },
    COMPLETE: {
      type: 'final',
    },
    EMERGENCY_PROTOCOL: {
      on: {
        CLEAR_REDFLAG: 'INIT', // or return to previous state, simplified to INIT for now
      },
    },
    STAFF_ASSIST: {
      on: {
        STAFF_ASSIST_RESOLVED: /* Return to history (omitted complex history states tracking for simplicity in MVP) */ 'INIT',
      },
    },
  },
});
