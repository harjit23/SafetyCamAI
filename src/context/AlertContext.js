import React, { createContext, useContext, useState } from 'react';

const AlertContext = createContext();

export const AlertProvider = ({ children }) => {
  const [alertInfo, setAlertInfo] = useState({ msg: '', isOpen: false });

  const showAlert = (msg) => {
    setAlertInfo({ msg, isOpen: true });
  };

  const closeAlert = () => {
    setAlertInfo({ msg: '', isOpen: false });
  };

  return (
    <AlertContext.Provider value={{ alertInfo, showAlert, closeAlert }}>
      {children}
    </AlertContext.Provider>
  );
};

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};
