import axios from 'axios';

const GATEWAY_URL = import.meta.env.VITE_API_URL || 'https://ai-study-space-backend.onrender.com';

export const gateway = axios.create({
  baseURL: GATEWAY_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default gateway;
