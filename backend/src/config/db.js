import mongoose from 'mongoose';

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/treehole';
  try {
    await mongoose.connect(uri);
    console.log('MongoDB connected:', uri.replace(/\/\/[^:]+:[^@]+@/, '//<credentials>@'));
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};

export default connectDB;
