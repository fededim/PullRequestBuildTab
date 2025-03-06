import ReactDOM = require('react-dom')

import "es6-promise/auto";
import * as React from "react";
import "./Common.scss";

export function showRootComponent(component: React.ReactElement<any>) {
    ReactDOM.render(component, document.getElementById("root"));
}
