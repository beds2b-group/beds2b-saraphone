/**
 *  Blind transfer (/transfer)
 *
 *  Called by SaraPhone (not by Twilio), so it can't be ".protected".
 *  POST params:
 *   CallSid   SID of the agent's own call leg (Twilio.Call.parameters.CallSid)
 *   identity  SaraPhone login of the agent doing the transfer
 *   target    SaraPhone login of the agent receiving the call (must be in AGENT_IDENTITIES)
 *
 *  The customer's leg is redirected with the REST API to a <Dial><Client>target</Client></Dial>.
 *  Leaving its current <Dial> ends the first agent's leg on its own, so no conference is needed.
 */

const RING_TIMEOUT_SECONDS = 20;

function getAgentIdentities(context) {
  return (context.AGENT_IDENTITIES || '')
    .split(',')
    .map((identity) => identity.trim())
    .filter(Boolean);
}

function reply(callback, status, body) {
  const response = new Twilio.Response();
  // CORS: SaraPhone is served from a different origin
  response.appendHeader('Access-Control-Allow-Origin', '*');
  response.appendHeader('Access-Control-Allow-Methods', 'POST');
  response.appendHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.appendHeader('Content-Type', 'application/json');
  response.setStatusCode(status);
  response.setBody(body);
  callback(null, response);
}

// Incoming call: the agent's leg is the child of the customer's call.
// Outgoing call: the agent's leg is the parent and the customer is its child.
async function findCustomerCallSid(client, agentCall) {
  if (agentCall.parentCallSid) return agentCall.parentCallSid;

  const children = await client.calls.list({ parentCallSid: agentCall.sid, limit: 20 });
  const active = children.find((c) => c.status === 'in-progress' || c.status === 'ringing');
  return active ? active.sid : null;
}

exports.handler = async function (context, event, callback) {
  const { CallSid, identity, target } = event;
  const agents = getAgentIdentities(context);

  if (!CallSid || !identity || !target) {
    return reply(callback, 400, { error: 'CallSid, identity and target are required' });
  }
  // Only agents can receive a transfer, never an arbitrary phone number
  if (!agents.includes(target)) {
    return reply(callback, 400, { error: 'target is not an agent' });
  }
  if (target === identity) {
    return reply(callback, 400, { error: 'cannot transfer to yourself' });
  }

  try {
    const client = context.getTwilioClient();
    const agentCall = await client.calls(CallSid).fetch();

    // The leg must belong to the agent asking for the transfer
    const clientId = `client:${identity}`;
    if (agentCall.from !== clientId && agentCall.to !== clientId) {
      return reply(callback, 403, { error: 'call does not belong to this agent' });
    }

    const customerCallSid = await findCustomerCallSid(client, agentCall);
    if (!customerCallSid) {
      return reply(callback, 409, { error: 'no customer leg found for this call' });
    }

    const twiml = new Twilio.twiml.VoiceResponse();
    // If the target doesn't answer, /voice says no agent is available and hangs up
    const dial = twiml.dial({
      timeout: RING_TIMEOUT_SECONDS,
      action: `https://${context.DOMAIN_NAME}/voice?dialEnded=true`,
    });
    dial.client(target);

    await client.calls(customerCallSid).update({ twiml: twiml.toString() });

    return reply(callback, 200, { transferred: true, customerCallSid, target });
  } catch (error) {
    console.error('Transfer failed:', error);
    return reply(callback, 500, { error: error.message });
  }
};
