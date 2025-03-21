import * as React from "react";

import { ObservableValue } from "azure-devops-ui/Core/Observable";
import { ISimpleListCell } from "azure-devops-ui/List";
import { MenuItemType } from "azure-devops-ui/Menu";
import { IStatusProps, Status, Statuses, StatusSize } from "azure-devops-ui/Status";
import {
    ColumnMore,
    ColumnSelect,
    ISimpleTableCell,
    renderSimpleCell,
    TableColumnLayout,
} from "azure-devops-ui/Table";
import { css } from "azure-devops-ui/Util";
import { ArrayItemProvider } from "azure-devops-ui/Utilities/Provider";
import { BuildResult, BuildStatus } from "azure-devops-extension-api/Build/Build";


interface IPipelineLastRun {
    startTime?: Date;
    endTime?: Date;
    duration: number;
    lastRunId: number;
    prId: number;
    runName: string;
    branchName: string;
    commitData: any;
    url: string;
}

export interface IPipelineItem {
    id: number;
    name: string;
    status: BuildStatus;
    result: BuildResult;
    lastRunData: IPipelineLastRun;
    favorite: ObservableValue<boolean>;
    logUrl: string;
    url: string;
}

interface IStatusIndicatorData {
    statusProps: IStatusProps;
    label: string;
}


export function buildStatusResultToNumber(pipeline: IPipelineItem): number {

    switch (pipeline.status) {
        case BuildStatus.None:
            return 0;
        case BuildStatus.NotStarted:
            return 1;
        case BuildStatus.Postponed:
            return 2;
        case BuildStatus.Cancelling:
            return 3;
        case BuildStatus.InProgress:
            return 4;

        case BuildStatus.Completed:
            switch (pipeline.result) {
                case BuildResult.Canceled:
                    return 5;
                case BuildResult.Failed:
                    return 6;
                case BuildResult.PartiallySucceeded:
                    return 7;
                case BuildResult.Succeeded:
                    return 8;

                default:
                    return 10;
            }

        default:
            return 11;
    }
}

export function getStatusIndicatorData(status: BuildStatus, result: BuildResult): IStatusIndicatorData {
    const indicatorData: IStatusIndicatorData = {
        label: "Success",
        statusProps: { ...Statuses.Success, ariaLabel: "Success" },
    };

    switch (status) {
        case BuildStatus.None:
        case BuildStatus.Postponed:
        case BuildStatus.NotStarted:
            indicatorData.statusProps = { ...Statuses.Queued, ariaLabel: "Queued" };
            indicatorData.label = "Queued";
            break;

        case BuildStatus.InProgress:
        case BuildStatus.Cancelling:
            indicatorData.statusProps = { ...Statuses.Running, ariaLabel: "Running" };
            indicatorData.label = "Running";
            break;

        case BuildStatus.Completed:
            switch (result) {
                case BuildResult.Canceled:
                    indicatorData.statusProps = { ...Statuses.Canceled, ariaLabel: "Canceled" };
                    indicatorData.label = "Canceled";
                    break;

                case BuildResult.Failed:
                    indicatorData.statusProps = { ...Statuses.Failed, ariaLabel: "Failed" };
                    indicatorData.label = "Failed";
                    break;

                case BuildResult.PartiallySucceeded:
                    indicatorData.statusProps = { ...Statuses.Warning, ariaLabel: "Warning" };
                    indicatorData.label = "Warning";
                    break;

                case BuildResult.Succeeded:
                    break;
            }
            break;
    }

    return indicatorData;
}
