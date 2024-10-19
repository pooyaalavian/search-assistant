import React from 'react';
import { createRoot } from 'react-dom/client';
import Assistant from './Assistant/Assistant';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';


(window as any).initPaccarAssistant = (elementId: string, apiServer: string, chassisElementId = 'buttonOpenREI', userNameElementId = '') => {
  if (!document.getElementById(elementId)) {
    document.body.appendChild(document.createElement('div')).id = elementId;
  }
  createRoot(document.getElementById(elementId)!).render(
    <BrowserRouter>
      <Assistant apiServer={apiServer} chassisElementId={chassisElementId} userNameElementId={userNameElementId} />
    </BrowserRouter>
  );
};

(window as any).refreshPaccarAssistant = () => {
  function _refresh() {
    let location = window.location.href.split('#')[0];
    location += '#assistant';
    if (window.location.href == location) {
      location += '1';
    }
    window.location.replace(location);
  }
  setTimeout(() => {
    _refresh();
  }, 5000);
};