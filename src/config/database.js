import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;

    if (!mongoURI) {
      throw new Error('MONGODB_URI chưa được cấu hình trong file .env');
    }

    const connection = await mongoose.connect(mongoURI);

    console.log(
      `MongoDB connected: ${connection.connection.host}`
    );
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

export default connectDB;