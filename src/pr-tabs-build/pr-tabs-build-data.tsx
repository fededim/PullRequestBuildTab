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

export interface ITableItem extends ISimpleTableCell {
    name: ISimpleListCell;
    age: number;
    gender: string;
}

export interface ILocationTableItem extends ISimpleTableCell {
    city: string;
    continent: ISimpleListCell;
    country: string;
    name: string;
    server: string;
    state: string;
}

export const fixedColumns = [
    {
        columnLayout: TableColumnLayout.singleLinePrefix,
        id: "name",
        name: "Name",
        readonly: true,
        renderCell: renderSimpleCell,
        width: new ObservableValue(-30),
    },
    {
        id: "age",
        name: "Age",
        readonly: true,
        renderCell: renderSimpleCell,
        width: new ObservableValue(-30),
    },
    {
        columnLayout: TableColumnLayout.none,
        id: "gender",
        name: "Gender",
        readonly: true,
        renderCell: renderSimpleCell,
        width: new ObservableValue(-40),
    },
];

export const checkboxColumns = [
    new ColumnSelect(),
    {
        id: "name",
        name: "Name",
        readonly: true,
        renderCell: renderSimpleCell,
        width: new ObservableValue(-30),
    },
    {
        id: "age",
        name: "Age",
        readonly: true,
        renderCell: renderSimpleCell,
        width: new ObservableValue(-30),
    },
    {
        id: "gender",
        name: "Gender",
        readonly: true,
        renderCell: renderSimpleCell,
        width: new ObservableValue(-40),
    },
];

export function onSizeMore(event: MouseEvent, index: number, width: number) {
    (moreColumns[index].width as ObservableValue<number>).value = width;
}

export const moreColumns = [
    {
        id: "name",
        minWidth: 50,
        name: "Name",
        onSize: onSizeMore,
        renderCell: renderSimpleCell,
        width: new ObservableValue(-30),
    },
    {
        id: "age",
        maxWidth: 300,
        name: "Age",
        onSize: onSizeMore,
        renderCell: renderSimpleCell,
        width: new ObservableValue(-30),
    },
    {
        id: "gender",
        name: "Gender",
        onSize: onSizeMore,
        renderCell: renderSimpleCell,
        width: new ObservableValue(-40),
    },
    new ColumnMore(() => {
        return {
            id: "sub-menu",
            items: [
                { id: "submenu-one", text: "SubMenuItem 1" },
                { id: "submenu-two", text: "SubMenuItem 2" },
                { id: "divider", itemType: MenuItemType.Divider },
                { id: "submenu-three", checked: true, readonly: true, text: "SubMenuItem 3" },
                { id: "submenu-four", disabled: true, text: "SubMenuItem 4" },
            ],
        };
    }),
];

export const renderStatus = (className?: string) => {
    return (
        <Status
            {...Statuses.Success}
            ariaLabel="Success"
            className={css(className, "bolt-table-status-icon")}
            size={StatusSize.s}
        />
    );
};

export const rawTableItems: ITableItem[] = [
    {
        age: 50,
        gender: "M",
        name: { iconProps: { render: renderStatus }, text: "Rory Boisvert" },
    },
    {
        age: 49,
        gender: "F",
        name: { iconProps: { iconName: "Home", ariaLabel: "Home" }, text: "Sharon Monroe" },
    },
    {
        age: 18,
        gender: "F",
        name: { iconProps: { iconName: "Home", ariaLabel: "Home" }, text: "Lucy Booth" },
    },
];

export const tableItems = new ArrayItemProvider<ITableItem>(rawTableItems);
export const tableItemsNoIcons = new ArrayItemProvider<ITableItem>(
    rawTableItems.map((item: ITableItem) => {
        const newItem = Object.assign({}, item);
        newItem.name = { text: newItem.name.text };
        return newItem;
    })
);

export const locationTableItems: ILocationTableItem[] = [
    {
        city: "San Francisco",
        continent: { text: "North America" },
        country: "United States",
        name: "Mission District",
        server: "West US",
        state: "California",
    },
    {
        city: "Paris",
        continent: { text: "Europe" },
        country: "France",
        name: "Batignolles-Monceau",
        server: "West Europe",
        state: "Ile-de-France",
    },
    {
        city: "Seoul",
        continent: { iconProps: { iconName: "Home", ariaLabel: "Home" }, text: "Asia" },
        country: "South Korea",
        name: "Gangnam",
        server: "East Asia",
        state: "Gyeonggi",
    },
    {
        city: "Manaus",
        continent: {
            iconProps: { iconName: "Home", ariaLabel: "Home" },
            text: "South America",
        },
        country: "Brazil",
        name: "Monterrey",
        server: "Brazil South",
        state: "Amazonas",
    },
];

export enum PipelineStatus {
    running = "running",
    succeeded = "succeeded",
    failed = "failed",
    warning = "warning",
}

export enum ReleaseType {
    prAutomated,
    tag,
    scheduled,
    manual,
}

interface IPipelineLastRun {
    startTime?: Date;
    endTime?: Date;
    prId: number;
    prName: string;
    releaseType: ReleaseType;
    branchName: string;
}

export interface IPipelineItem {
    name: string;
    status: PipelineStatus;
    lastRunData: IPipelineLastRun;
    favorite: ObservableValue<boolean>;
}

interface IStatusIndicatorData {
    statusProps: IStatusProps;
    label: string;
}

export function getStatusIndicatorData(status: string): IStatusIndicatorData {
    status = status || "";
    status = status.toLowerCase();
    const indicatorData: IStatusIndicatorData = {
        label: "Success",
        statusProps: { ...Statuses.Success, ariaLabel: "Success" },
    };
    switch (status) {
        case PipelineStatus.failed:
            indicatorData.statusProps = { ...Statuses.Failed, ariaLabel: "Failed" };
            indicatorData.label = "Failed";
            break;
        case PipelineStatus.running:
            indicatorData.statusProps = { ...Statuses.Running, ariaLabel: "Running" };
            indicatorData.label = "Running";
            break;
        case PipelineStatus.warning:
            indicatorData.statusProps = { ...Statuses.Warning, ariaLabel: "Warning" };
            indicatorData.label = "Warning";

            break;
    }

    return indicatorData;
}

export function ReleaseTypeText(props: { releaseType: ReleaseType }) {
    switch (props.releaseType) {
        case ReleaseType.prAutomated:
            return "PR Automated";
        case ReleaseType.manual:
            return "Manually triggered";
        case ReleaseType.scheduled:
            return "Scheduled";
        default:
            return "Release new-features";
    }
}
