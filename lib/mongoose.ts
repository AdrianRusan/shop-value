import mongoose from 'mongoose';

let isConnected = false;

export const connectToDB = async () => {
  mongoose.set('strictQuery', true);

  if (!process.env.MONGODB_URI)
    return console.log('MONGODB_URI is not defined');

  if (isConnected) return console.log('Already connected to DB');

  try {
    await mongoose.connect(process.env.MONGODB_URI);

    isConnected = true;
  } catch (error) {
    console.log(error);
  }
};
