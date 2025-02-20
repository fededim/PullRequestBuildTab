import { showRootComponent } from "../Common";
import * as React from "react";
import { Header, TitleSize } from "azure-devops-ui/Header";
import { Page, IPageProps, Orientation } from "azure-devops-ui/Page";
import { Card } from "azure-devops-ui/Card";
import { IHeaderCommandBarItem } from "azure-devops-ui/HeaderCommandBar";
import * as SDK from "azure-devops-extension-sdk";
import "azure-devops-ui/Core/override.css";


export class PrTabsBuild extends React.Component<{}, {}> {
    public componentDidMount() {
        SDK.init();
    }

    public render() : JSX.Element {
        return (
            <div style={{width:"100%"}}>
                <Header title="Builds" titleSize={TitleSize.Large}/>
                <div className="page-content flex-grow" style={{marginTop: "20px", marginLeft: "20px", marginRight: "20px"}}>
                    <Card>Page content new</Card>
                </div>
            </div>
        );
    }
}
export default PrTabsBuild;

showRootComponent(<PrTabsBuild />);
