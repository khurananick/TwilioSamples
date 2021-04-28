Sample dialer to make outbound call to an Agent and a Customer.
The dialer makes a call to the Agent, and then calls the Customer.
If Customer voicemail is detected, the dialer triggers a webhook, which ends the Agent call leg and leaves a voicemail for the Customer.

Step 1: Start by calling Outbound.js to make the calls.
Step 2: Ensure your AMDResponseWebhookEndpoint.js endpoint is listening for AMD webhook from Twilio.
