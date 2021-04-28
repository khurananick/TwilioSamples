const client = require('twilio')('ACXXX', '55XXX');
const agentNum = "+14083334444"; // number of the agent.
const userNum = "+14084445555"; // number of the customer.
const callerId = "+14082223333"; // the Twilio number to show in Caller ID.

(async function() {
  // creates the outbound call leg to the Agent and puts the Agent into a queue.
  const agentCall = await client.calls
    .create({
      twiml: `<Response><Enqueue>${userNum}</Enqueue></Response>`,
      to: agentNum,
      from: callerId
     });

  setTimeout(async function() {
    // creates the outbound call leg to the Customer, then dials the queue in which the Agent is waiting.
    const userCall = await client.calls
      .create({
        twiml: `<Response><Dial><Queue>${userNum}</Queue></Dial></Response>`,
         machineDetection: 'Enable',
         asyncAmdStatusCallback: `https://yourdomain.com/path/to/AMDResponseWebhookEndpoint.js?agentCallSid=${agentCall.sid}`, // the webhook endpoint.
         asyncAmd: true,
         to: userNum,
         from: callerId
       })
  }, 1000);
})();
