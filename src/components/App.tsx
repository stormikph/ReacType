import React, { Component } from 'react';
import '../public/styles/style.css';
// import { MuiThemeProvider } from '@material-ui/core/styles';
import AppContainer from '../containers/AppContainer';

export const App: React.SFC = () => (
  <div className="app">
    <div>
      <header style={{ height: '40px', width: '100%' }}>ReacType</header>
      <AppContainer />
    </div>
  </div>
);

export default App;

