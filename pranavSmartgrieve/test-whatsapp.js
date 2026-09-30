require('dotenv').config();
const { addToIntakeQueue, processGrievanceWithAI, connection } = require('./src/services/ai.service');
const mongoose = require('mongoose');
const { Queue } = require('bullmq');

async function testPipeline() {
    console.log("Connecting to DB...");
    await mongoose.connect(process.env.MONGO_URI);
    
    // Send a message
    console.log("Pushing to intake queue...");
    const mockPayload = {
      object: "whatsapp_business_account",
      entry: [{
        id: "12345",
        changes: [{
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "911234567890",
              phone_number_id: process.env.PHONE_NUMBER_ID || "123456789"
            },
            contacts: [{
              profile: { name: "Test User" },
              wa_id: "919999999999"
            }],
            messages: [{
              from: "919999999999",
              id: "wamid.test." + Date.now(),
              timestamp: Date.now().toString(),
              type: "text",
              text: { body: "There is a massive pothole in front of DB Mall" }
            }]
          }
        }]
      }]
    };
    
    await addToIntakeQueue(mockPayload);
    
    // Wait for intake to process and create Grievance
    console.log("Waiting for intake processing (3s)...");
    await new Promise(r => setTimeout(r, 3000));
    
    // Instead of waiting 30s, force it into the AI queue
    console.log("Finding grievance...");
    const Grievance = require('./src/models/grievance.model');
    const doc = await Grievance.findOne({ userId: "919999999999", status: "Collecting" });
    
    if (doc) {
        console.log("Force finishing collection and triggering AI...");
        doc.status = 'Pending';
        doc.finalTextForAI = doc.rawContent.join(" ");
        await doc.save();
        await processGrievanceWithAI(doc._id);
    } else {
        console.log("Grievance not found in Collecting state.");
    }
    
    // Wait for AI and System agent to finish
    console.log("Waiting for AI processing (10s)...");
    await new Promise(r => setTimeout(r, 10000));
    
    console.log("Test finished.");
    process.exit(0);
}

testPipeline();
