const client = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

client.calls(req.query.agentCallSid)
      .update({twiml: '<Response><Say>Voicemail Detected. Goodbye.</Say></Response>'})
      .then(call => console.log(call.to));

client.calls(req.body.CallSid)
      .update({twiml: '<Response><Say loop="2">This is a voicemail from our team. Please follow these instructions.</Say></Response>'})
      .then(call => console.log(call.to));
