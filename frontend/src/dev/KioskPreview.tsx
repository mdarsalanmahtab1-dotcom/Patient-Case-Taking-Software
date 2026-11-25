/**
 * DEV ONLY — renders kiosk screens with sample data so layout can be checked
 * without starting a real session (which writes to the database).
 * Mounted from App.tsx only when import.meta.env.DEV is true; never in a production build.
 *
 * Open: http://localhost:5173/dev/kiosk-preview?screen=interview
 * Screens: interview | interview-ayush | upload | review | alert | summary | token
 */
import { useSearchParams, Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { AudioGuideProvider } from '../context/AudioGuideContext';
import { Screen3_ConversationalIntake } from '../screens/Screen3_ConversationalIntake';
import { Screen5_DocumentScanner } from '../screens/Screen5_DocumentScanner';
import { Screen6_DigitizationVerification } from '../screens/Screen6_DigitizationVerification';
import { Screen7_TriageAlert } from '../screens/Screen7_TriageAlert';
import { Screen8_Complete } from '../screens/Screen8_Complete';
import type { UIInstruction } from '../hooks/useConversation';

const noop = () => {};

const sampleRecord = {
  patient_name: 'Sample Patient',
  patient_age: 62,
  patient_sex: 'Female',
  chief_complaint: { value: 'Chest pain on walking, 2 days' },
  filled_state: {
    pain_location: { value: 'Centre of chest', question: 'Where is the pain?', status: 'filled' },
    pain_duration: { value: '2 days', question: 'How long have you had it?', status: 'filled' },
    body_weight_kg: { value: '58 kg', status: 'filled' },
    blood_pressure: { value: '130/85 mmHg', status: 'filled' },
  },
  document_extractions: [
    {
      doc_type: 'Prescription',
      requires_human_verification: false,
      entities: [{
        medications: [{ drug_name: 'Amlodipine', dosage: '5 mg once daily' }, { drug_name: 'Aspirin', dosage: '75 mg' }],
        diagnoses: [{ condition_name: 'Hypertension' }],
        lab_values: [{ test_name: 'HbA1c', value: '7.9', unit: '%', is_abnormal: true }, { test_name: 'Creatinine', value: '0.9', unit: 'mg/dL' }],
      }],
    },
  ],
  unverifiable_values: [],
};

function interviewUi(ayush: boolean): UIInstruction {
  return {
    macro_state: ayush ? 'PRAKRITI' : 'HPI',
    clinic_mode: ayush ? 'ayush' : 'allopathic',
    session_id: '',
    language: 'en-IN',
    screen: 'conversation',
    orb_state: 'idle' as any,
    prompt: 'Where exactly do you feel the pain?',
    ack: 'Thank you. Chest pain for 2 days noted.',
    section_label: ayush ? 'PRAKRITI' : 'HPI',
    progress: { done: 3, total: 12 },
    can_skip: true,
    options: [
      { label: 'Chest', icon: null },
      { label: 'Head', icon: null },
      { label: 'Stomach', icon: null },
      { label: 'Back', icon: null },
      { label: 'Legs', icon: null },
      { label: 'Somewhere else', icon: null },
    ],
    conversation_history: [
      { role: 'assistant', content: 'What brings you to the hospital today?' },
      { role: 'patient', content: 'I have chest pain since 2 days' },
    ],
  };
}

export default function KioskPreview() {
  const [params] = useSearchParams();
  const screen = params.get('screen') || 'interview';
  const isInterview = screen.startsWith('interview');

  let body: React.ReactNode;
  switch (screen) {
    case 'interview':
    case 'interview-ayush': {
      const ui = interviewUi(screen === 'interview-ayush');
      body = (
        <Screen3_ConversationalIntake
          ui={ui}
          orbState={'idle' as any}
          isProcessing={false}
          onTap={noop}
          onVoice={noop}
          onSkip={noop}
          onBack={noop}
          onRedflag={noop}
        />
      );
      break;
    }
    case 'upload':
      body = <Screen5_DocumentScanner language="en-IN" onNext={noop} onSkip={noop} />;
      break;
    case 'review':
      body = <Screen6_DigitizationVerification patientRecord={sampleRecord} language="en-IN" onNext={noop} onBack={noop} />;
      break;
    case 'alert':
      body = <Screen7_TriageAlert onResume={noop} onNewPatient={noop} />;
      break;
    case 'summary':
    case 'token':
      body = <Screen8_Complete patientRecord={sampleRecord} language="en-IN" previewSent={screen === 'token'} />;
      break;
    default:
      body = (
        <div className="p-8 space-x-4">
          {['interview', 'interview-ayush', 'upload', 'review', 'alert', 'summary', 'token'].map(s => (
            <Link key={s} className="text-blue-700 underline" to={`?screen=${s}`}>{s}</Link>
          ))}
        </div>
      );
  }

  return (
    <AudioGuideProvider>
      <Layout isConnected isKioskInterview={isInterview} clinicMode={screen === 'interview-ayush' ? 'ayush' : 'allopathic'}>
        <div className="relative w-full grow flex flex-col h-full overflow-hidden">{body}</div>
      </Layout>
    </AudioGuideProvider>
  );
}
