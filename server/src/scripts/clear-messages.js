require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const m = await Message.deleteMany({});
  const c = await Conversation.deleteMany({});
  console.log(`Deleted ${m.deletedCount} messages, ${c.deletedCount} conversations`);
  await mongoose.disconnect();
}).catch((e) => { console.error(e); process.exit(1); });
