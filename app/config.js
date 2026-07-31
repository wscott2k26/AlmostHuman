// Safe public runtime configuration. Supabase publishable keys are intended for
// client applications and are protected by Row Level Security. Never place a
// Supabase secret key, database password, OpenAI key, or billing secret here.
window.__ALMOST_HUMAN_CONFIG__ = Object.freeze({
  supabaseUrl: 'https://onvoaskzzxozmhkzyycy.supabase.co',
  supabasePublishableKey: 'sb_publishable_v9r-boNlafDWnQUbX-7-UQ_Ovwpvadh',
  projectRef: 'onvoaskzzxozmhkzyycy',
  billingMode: 'preview',
  environment: 'production',
  authRedirectPath: '',
  functionNames: {
    chatService: 'chat-service',
    activityService: 'activity-service',
    memoryExtract: 'memory-extract',
    memoryControl: 'memory-control',
    privacyService: 'privacy-service',
    conversationReset: 'conversation-reset',
    progressAging: 'progress-aging',
    diagnosticsService: 'diagnostics-service',
    voiceService: 'voice-service',
    letterService: 'letter-service',
    health: 'health'
  }
});
