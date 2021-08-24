exports.handler = async function(context, event, callback) {
    const client = context.getTwilioClient();
    const agentNum = "+1408XXXXXX"; // Number to connect the call to.
    const userNum = event.From; // Number the call is coming from.
    const callerId = event.To; // Number to show when connecting call to agentNum.
    
    // makes the outbound call to leg to the person whom we're connecting the inbound call to.
    // upon answer, it plays a message "you have a call from +. 1. 2. 1. 2. 3. 4. 2. 5. 5. 5. 5." then connects the two callers.
    const agentCall = await client.calls
      .create({
        twiml: `<Response><Say>You have a call from ${userNum.split("").join(". ")}</Say><Dial><Queue>${userNum}</Queue></Dial></Response>`,
         to: agentNum,
         from: callerId
       });

    // puts the current caller on hold, the above agentCall will connect after agents picks up and hears the message. 
    const response = new Twilio.twiml.VoiceResponse();
    response.enqueue(event.From);
    callback(null, response);
};
