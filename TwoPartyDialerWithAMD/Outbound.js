const client = require('twilio')('ACXXX', '55XXX');
const agentNum = "+14083334444";
const userNum = "+14084445555";
const callerId = "+14082223333";

(async function() {
  const agentCall = await client.calls
    .create({
      twiml: `<Response><Enqueue>${userNum}</Enqueue></Response>`,
      to: agentNum,
      from: callerId
     });

  setTimeout(async function() {
    const userCall = await client.calls
      .create({
        twiml: `<Response><Dial><Queue>${userNum}</Queue></Dial></Response>`,
         machineDetection: 'Enable',
         asyncAmdStatusCallback: `https://yourdomain.com/path/to/amd/response?agentCallSid=${agentCall.sid}`,
         asyncAmd: true,
         to: userNum,
         from: callerId
       })
  }, 1000);
})();
