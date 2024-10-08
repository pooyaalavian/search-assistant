import React from 'react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Assistant from './Assistant/Assistant'
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Assistant apiServer='' chassisElementId='' userNameElementId=''/>
  </StrictMode>,
)
