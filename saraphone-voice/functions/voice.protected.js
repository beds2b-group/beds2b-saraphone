/**
 *  Voice webhook (/voice)
 *
 *  Configure this URL as:
 *   - Phone number "A call comes in"  -> incoming calls ring every agent at once
 *   - TwiML App "Voice Request URL"   -> outgoing calls made from SaraPhone
 *
 *  Env vars:
 *   AGENT_IDENTITIES  comma separated SaraPhone logins, e.g. "55001,55002" (max 10)
 *   CALLER_ID         Twilio number used as caller id for outgoing calls
 *
 *  ".protected" makes Twilio validate X-Twilio-Signature, so only Twilio can call it.
 */

const RING_TIMEOUT_SECONDS = 20;
const MAX_CLIENTS_PER_DIAL = 10;

function isAValidPhoneNumber(number) {
  return /^[\d\+\-\(\) ]+$/.test(number);
}

function getAgentIdentities(context) {
  return (context.AGENT_IDENTITIES || '')
    .split(',')
    .map((identity) => identity.trim())
    .filter(Boolean);
}

function say(twiml, text) {
  twiml.say({ language: 'es-ES' }, text);
}

// Outgoing: SaraPhone -> phone number or another agent
function handleOutgoing(context, event, twiml) {
  if (!event.To) {
    say(twiml, 'No se ha indicado ningún destino.');
    return;
  }

  // Agent logins are numeric too, so check the agent list before the phone format
  const isAgent = getAgentIdentities(context).includes(event.To);
  const dial = twiml.dial({ answerOnBridge: true, callerId: context.CALLER_ID });
  if (isAgent || !isAValidPhoneNumber(event.To)) {
    dial.client(event.To);
  } else {
    dial.number(event.To);
  }
}

// Incoming: phone number -> every agent at once, first to answer wins
function handleIncoming(context, event, twiml) {
  const agents = getAgentIdentities(context);
  if (agents.length === 0) {
    say(twiml, 'No hay agentes configurados. Por favor, llame más tarde.');
    return;
  }

  // "action" is requested when the Dial ends, with DialCallStatus
  const dial = twiml.dial({
    timeout: RING_TIMEOUT_SECONDS,
    action: '/voice?dialEnded=true',
  });
  agents.slice(0, MAX_CLIENTS_PER_DIAL).forEach((identity) => dial.client(identity));
}

// Called via the Dial "action" once ringing the agents has finished
function handleDialEnded(event, twiml) {
  if (event.DialCallStatus === 'completed') {
    twiml.hangup();
    return;
  }
  say(twiml, 'En este momento no hay ningún agente disponible. Por favor, llame más tarde.');
  twiml.hangup();
}

exports.handler = function (context, event, callback) {
  const twiml = new Twilio.twiml.VoiceResponse();
  const isFromSaraPhone = (event.From || '').startsWith('client:');

  if (event.dialEnded) {
    handleDialEnded(event, twiml);
  } else if (isFromSaraPhone) {
    handleOutgoing(context, event, twiml);
  } else {
    handleIncoming(context, event, twiml);
  }

  callback(null, twiml);
};
