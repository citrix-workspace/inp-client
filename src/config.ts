import dotenv from 'dotenv'
import {Dictionary} from "./types";

dotenv.config()

export const {INP_BASE_URL, CUSTOMER_ID, USER_ID}: Dictionary = process.env
