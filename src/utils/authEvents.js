// src/utils/authEvents.js
import { EventEmitter } from 'eventemitter3';

const authEvents = new EventEmitter();

export const AUTH_EVENTS = {
    LOGOUT: 'LOGOUT',
};

export default authEvents;
