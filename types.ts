
export interface TranscriptionResult {
  text: string;
  timestamp: Date;
  source: 'file' | 'microphone';
  fileName?: string;
}

export enum AppStatus {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}
