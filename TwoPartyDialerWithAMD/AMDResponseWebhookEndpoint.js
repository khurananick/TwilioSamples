// the webhook endpoint called by answering machine detection.

const client = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

if(req.body.AnsweredBy == 'machine_start') {
  // lets the agent know there was voicemail detected.
  client.calls(req.query.agentCallSid)
      .update({twiml: '<Response><Say>Voicemail Detected. Goodbye.</Say></Response>'})
      .then(call => console.log(call.to));

  // leaves voicemail for the customer.
  client.calls(req.body.CallSid)
      .update({twiml: '<Response><Say loop="2">This is a voicemail from our team. Please follow these instructions.</Say></Response>'})
      .then(call => console.log(call.to));
}
