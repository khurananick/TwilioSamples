exports.handler = async function(context, event, callback) {
  const client = context.getTwilioClient(); // twilio client needed to make or update live calls.
  const baseUrl = 'https://{YOUR_FUNCTION_DOMAIN}/path/to/this/function'; // the public endpoint to this function.

  // function that should be a database query to look up the agent phone numbers
  // who should be reached out to if a call is received to this inbound phone number.
  function getListOfAgentsToTry() {
    return ["{YOUR_FIRST_AGENT_NUMBER_TO_TRY}", "{YOUR_SECOND_AGENT_NUMBER_TO_TRY}"];
  }

  // if no agents pick up the phone, we simply play a message to the caller to ask 
  // them to try again later. this can be used to send the caller to voicemail as well.
  async function handleNoAgentsAvailable() {
    const call = await client.calls(event.originCallSid)
      .update({
        twiml: `<Response><Say>We're sorry, no one is available to take your call at this time. Please try again later.</Say></Response>`,
      });
    return;
  }

  // this function looks up the agent numbers that are mapped to the inbound
  // phone number the call is coming into, then tries the next available agent
  // based on the number of attempts we've already tried.
  // The attempt is set to 0 at first, and passed into the URL callback,
  // and subsequently incremented each time the callback is triggered after
  // an agent does not respond to the call.
  async function callNextAvailableAgent(originCallSid) {
    const attempt = Number(event.AgentAttempt||0) + 1;
    const agentNum = getListOfAgentsToTry()[attempt-1]; // Number to connect the call to.
    const oCallSid = originCallSid || event.originCallSid;

    if(!agentNum) {
      return await handleNoAgentsAvailable();
    }

    const callerId = event.callerId || event.To; // Number to show when connecting call to agentNum.
    const userNum = event.userNum || event.From; // Number the call is coming from.
    const sayStr = `You have a call from ${userNum.split("").join(". ")}. Press 1 to accept.`;
    const getParams = `agentNum=${encodeURIComponent(agentNum)}&amp;userNum=${encodeURIComponent(userNum)}&amp;callerId=${encodeURIComponent(callerId)}&amp;originCallSid=${oCallSid}`;
    // makes the outbound call to leg to the person whom we're connecting the inbound call to.
    // upon answer, it plays a message "you have a call from +. 1. 2. 1. 2. 3. 4. 2. 5. 5. 5. 5." then connects the two callers.
    const agentCall = await client.calls
      .create({
        twiml: `<Response><Gather action='${baseUrl}?${getParams}' method='POST'><Say>${sayStr}</Say></Gather></Response>`,
         to: agentNum,
         from: callerId,
         statusCallback: `${baseUrl}?AgentResponse=noresponse&AgentAttempt=${attempt}&userNum=${encodeURIComponent(userNum)}&callerId=${encodeURIComponent(callerId)}&originCallSid=${oCallSid}`,
         statusCallbackMethod: 'POST'
       });
  }

  // when the initial inbound call is received, we want to put the caller into a queue
  // the last three lines of this function are doing that, putting the caller into a queue
  // and the name of the queue is set to the number the caller is calling from. the first
  // line of the function is starting the agent outbound calling to connect the caller
  // to the first agent who picks up.
  async function handleInitialInboundCall() {
    await callNextAvailableAgent(event.CallSid);
    // puts the current caller on hold, the above agentCall will connect after agents picks up and hears the message. 
    const response = new Twilio.twiml.VoiceResponse();
    response.say('Please wait while we connect your call.');
    response.enqueue(event.From);
    return response;
  }

  // we already have created a queue and placed the original caller into that queue in the initial call
  // now, if the agent responds and accepts the call, we put the agent into the
  // same queue, which dequeues the current caller and connects both parties into a
  // 2-way phone call.
  async function addAgentToQueue() {
    const response = new Twilio.twiml.VoiceResponse();
    const dial = response.dial();
    dial.queue(event.userNum);
    return response;
  }

  // this action is called when the agent presses 1 to accept the call, or presses any other digit
  // or presses nothing. basically, when the agent receives a call, she has the option to press 1,
  // press nothing or press any button, no matter the choice, this endpoint is going to get called
  // if the agent pressed 1, we connect the two users and change the statuscallback so we don't
  // keep dialing the next agent, because this one has responded. 
  // if the agent presses nothing, or anything but 1, we simply let the agent know we'll try
  // the next one on the list and hang up.
  async function handleDigitsFromCall() {
    if(event.Digits == 1) {
      const agentCall = await client.calls(event.CallSid)
        .update({
          url: `${baseUrl}?AddAgentToQueue=true&userNum=${encodeURIComponent(event.userNum)}`,
          statusCallback: `${baseUrl}?AgentResponse=responded`,
        });
    } else {
      const response = new Twilio.twiml.VoiceResponse();
      response.say("Thank you, we will try the next available agent.");
      return response;
    }
  }

  let response = null;


  // this is the main routing logic for the inbound call and all of the subsequeent calls we make.

  if(event.AgentResponse == "noresponse") {
    // STEP 3c: Again, this endpoint is called every time the agent call leg is hung up,
    // if the agent did not accept the call, the hangup callback will say "noresponse" in the
    // AgentResponse param, that means the agent did not answer, so we just continue
    // to try the next available agent.
    await callNextAvailableAgent();
  }
  else if(event.AgentResponse == "responded") {
    // STEP 3b: Once the agent hangs up, there's a final status callback that is calling
    // this endpoing. Because the agent accepted the call, we had updated the callback
    // URL to stay the agent responded, thus we don't have to take any further steps, the
    // caller and the agent have already spoken.
  }
  else if(event.AddAgentToQueue) {
    // STEP 3a: This is the ideal step three. We've taken the inbound call, 
    // the caller has been placed into a queue, the agent has been called and asked to press 1
    // in order to accept the call, and the agent has pressed 1, so we're now going to put the
    // agent into the queue and connect the two callers together.
    response = await addAgentToQueue();
  }
  else if(event.Digits) {
    // STEP 2: We called the agent, and we played the message to ask the agent
    // to press 1 to accept the inbound call. If the agent presses any key other
    // than 1, we will try the next available agent. If the agent doesn't press any 
    // key at all, we will try the next available agent. if the agent doesn't answer
    // we'll play the message to the answering machine, and when the message is done playing
    // it will return with no key pressed, so we'll try the next agent.
    // If the agent picks up and presses 1, we will connect the agent to the caller.
    response = await handleDigitsFromCall();
  }
  else {
    // STEP 1: When the first inbound call is received, it doesn't have
    // any of the custom parameters (AgentResponse, Digits, AddAgentToQueue)
    // because no action has taken place yet, we just received the call.
    // so we're going to put the caller into a queue and start dialing 
    // out to the first available agent.
    response = await handleInitialInboundCall();
  }

  callback(null, response);
};
