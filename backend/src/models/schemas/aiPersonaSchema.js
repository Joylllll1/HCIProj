import mongoose from 'mongoose';
import { aiPersonaFieldDefinitions } from '../../services/aiPersonaConfig.js';

const aiPersonaSchema = new mongoose.Schema(
  aiPersonaFieldDefinitions,
  {
    _id: false,
    id: false,
    minimize: true,
  }
);

export default aiPersonaSchema;
