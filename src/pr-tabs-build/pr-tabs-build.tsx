import { showRootComponent } from "../Common";
import { HttpTransportType, HubConnection, HubConnectionBuilder, LogLevel, MessageHeaders } from '@microsoft/signalr';

import * as React from "react";
import {
    getStatusIndicatorData,
    buildStatusResultToNumber,
    IPipelineItem
} from "./pr-tabs-build-data";

import * as SDK from "azure-devops-extension-sdk";

import { Card } from "azure-devops-ui/Card";
import { Icon, IIconProps } from "azure-devops-ui/Icon";
import { Link } from "azure-devops-ui/Link";
import { Status, StatusSize } from "azure-devops-ui/Status";
import {
    ColumnMore,
    ITableColumn,
    SimpleTableCell,
    Table,
    TwoLineTableCell,
    ColumnSorting,
    SortOrder,
    sortItems,
} from "azure-devops-ui/Table";

import { VssPersona, IIdentityDetailsProvider } from "azure-devops-ui/VssPersona";

import { Ago } from "azure-devops-ui/Ago";
import { Duration } from "azure-devops-ui/Duration";
import { Tooltip } from "azure-devops-ui/TooltipEx";
import { css } from "azure-devops-ui/Util";
import { ArrayItemProvider } from "azure-devops-ui/Utilities/Provider";
import { ObservableValue } from "azure-devops-ui/Core/Observable";
import { Observer } from "azure-devops-ui/Observer";
import { CoreRestClient } from "azure-devops-extension-api/Core";

import { CommonServiceIds, IProjectPageService, IHostNavigationService, IProjectInfo } from "azure-devops-extension-api";
import { BuildRestClient } from "azure-devops-extension-api/Build/BuildClient";
import { GitRestClient } from "azure-devops-extension-api/Git/GitClient";
import { NotificationRestClient } from "azure-devops-extension-api/Notification/NotificationClient";
import { PipelinesRestClient } from "azure-devops-extension-api/Pipelines/PipelinesClient";
import { getClient } from 'azure-devops-extension-api'
import { BuildReason, BuildQueryOrder } from "azure-devops-extension-api/Build/Build";


interface IPullRequestTabGroupState {
    projectContext?: IProjectInfo;
    extensionContext?: SDK.IExtensionContext;
    hostContext?: SDK.IHostContext;
    hostNavigationService?: IHostNavigationService;
    pullRequestUpdateService: any;
    accessToken: string;
    appToken: string;
    pullRequestId: number;
    projectName: string;
    gitRepositoryName: string;
}

const PullRequestUpdateServiceId: string = "ms.vss-code-web.pr-updates-service";
const AUTOREFRESHTIME: number = 15000;

export default class PrTabsBuild extends React.Component<{}, IPullRequestTabGroupState> {

    private pipelineItems: IPipelineItem[] = [];

    private refreshTimer?: NodeJS.Timeout;

    constructor(props: {}) {
        super(props);
        this.state = { projectContext: undefined, extensionContext: undefined, hostContext: undefined, hostNavigationService: undefined, pullRequestUpdateService: undefined, accessToken: '', appToken: '', pullRequestId: 0, gitRepositoryName: '', projectName: '' };
    }


    public componentDidMount() {
        try {
            console.log("Component did mount, initializing SDK...");
            SDK.init();

            SDK.ready().then(() => {
                console.log("SDK is ready, loading project context...");

                this.loadProjectContext();
            }).catch((error) => {
                console.error("Loading project context failed: ", error);
            });
        }
        catch (error) {
            console.error("Error during SDK initialization or project context loading: ", error);
        }
    }




    public componentWillUnmount() {
        this.disableAutorefresh();
    }


    private async subscribeEvents() {
        setTimeout(() => {
            this.state.pullRequestUpdateService?.signalRHub?.hub.on("OnBranchUpdated", (message: any) => {
                if (message.isSourceUpdate && message.pullRequestId == this.state.pullRequestId) {
                    console.debug("a new commit has been pushed to source branch");
                    this.enableAutorefresh();
                }
            });
            console.debug("subscribed to OnBranchUpdated event");
        }, 1000);
    }


    private disableAutorefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = undefined;
            console.debug("disabled autorefresh");
        }
    }


    private enableAutorefresh() {
        if (!this.refreshTimer) {
            this.refreshTimer = setInterval(async () => {
                await this.refreshBuildsData();
            }, AUTOREFRESHTIME);
            console.debug("enabled autorefresh");
        }
    }


    private async refreshBuildsData() {
        const gitClient = getClient(GitRestClient);
        const buildClient = getClient(BuildRestClient);

        let pullRequest = await gitClient.getPullRequestById(this.state.pullRequestId, this.state.projectName);
        let pullRequestBranch = `refs/pull/${this.state.pullRequestId}/merge`;
        let builds = await buildClient.getBuilds(this.state.projectName, undefined, undefined, undefined, undefined, undefined, undefined, BuildReason.PullRequest, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, BuildQueryOrder.StartTimeDescending, pullRequestBranch, undefined, pullRequest.repository.id, 'TfsGit');

        let commitIds = builds.map(b => JSON.parse(b.parameters)["system.pullRequest.sourceCommitId"]) as string[];
        let commitsSearchCriteria: any = { ids: commitIds };

        var commitsDictionary: { [details: string]: any; } = {};
        var commits = await gitClient.getCommits(pullRequest.repository.id, commitsSearchCriteria);
        commits.forEach((c, index) => commitsDictionary[c.commitId] = c);

        console.debug("refreshBuildsData called, number of builds returned " + builds?.length);

        if (builds?.length > 0) {
            this.pipelineItems = builds.map(b => {
                var commitData = commitsDictionary[JSON.parse(b.parameters)["system.pullRequest.sourceCommitId"]];
                commitData.commitUrl = `https://dev.azure.com/${this.state.hostContext?.name}/${this.state.projectContext?.name}/_git/${b.repository.name}/commit/${commitData.commitId}?refName=${pullRequest.sourceRefName}`;

                return {
                    favorite: new ObservableValue<boolean>(true),
                    lastRunData: {
                        branchName: pullRequest.sourceRefName.replace("refs/heads/", ""),
                        prId: this.state.pullRequestId,
                        runName: `#${b.buildNumber} \u00b7 ${commitData.comment}`,
                        startTime: b.startTime,
                        endTime: b.finishTime,
                        duration: (!b.startTime) ? 1000000000 : ((b.finishTime ?? new Date()).getTime() - b.startTime.getTime()) / 1000,
                        commitData: commitData,
                        url: `https://dev.azure.com/${this.state.hostContext?.name}/${this.state.projectContext?.name}/_build/results?buildId=${b.id}&view=results`
                    },
                    id: b.id,
                    name: b.definition.name,
                    status: b.status,
                    result: b.result,
                    logUrl: `https://dev.azure.com/${this.state.hostContext?.name}/${this.state.projectContext?.name}/_build/results?buildId=${b.id}&view=logs`,
                    url: `https://dev.azure.com/${this.state.hostContext?.name}/${this.state.projectContext?.name}/_build?definitionId=${b.definition.id}&_a=summary`
                };
            }) as IPipelineItem[];
        }
        else
            this.pipelineItems = [];

        this.itemProvider.value = new ArrayItemProvider(this.pipelineItems);

        // enable autorefresh if there is at least a running build otherwise disable it
        if (this.pipelineItems.some(pi => !pi.lastRunData.endTime)) {
            this.enableAutorefresh();
        }
        else {
            this.disableAutorefresh();
        }

        //this.itemProvider.notify(this.itemProvider.value, "newData");
    }



    private async loadProjectContext(): Promise<void> {
        try {
            const hostNavigationService = await SDK.getService<IHostNavigationService>(CommonServiceIds.HostNavigationService);
            const projectClient = await SDK.getService<IProjectPageService>(CommonServiceIds.ProjectPageService);
            const projectContext = await projectClient.getProject();
            const extensionContext = await SDK.getExtensionContext();
            const hostContext = SDK.getHost();
            const pullRequestUpdateService = await SDK.getService(PullRequestUpdateServiceId);
            const accessToken = await SDK.getAccessToken()
            const appToken = await SDK.getAppToken()

            const navRoute = await hostNavigationService.getPageRoute();
            const pullRequestId = Number(navRoute.routeValues.parameters);
            const projectName = navRoute.routeValues.project;
            const gitRepositoryName = navRoute.routeValues.GitRepositoryName;

            this.setState({ projectContext: projectContext, extensionContext: extensionContext, hostContext: hostContext, hostNavigationService: hostNavigationService, pullRequestUpdateService: pullRequestUpdateService, accessToken: accessToken, appToken: appToken, pullRequestId: pullRequestId, projectName: projectName, gitRepositoryName: gitRepositoryName });

            await this.subscribeEvents();

            SDK.notifyLoadSucceeded();

            await this.refreshBuildsData();
        } catch (error) {
            console.error("Failed to load project context: ", error);
        }
    }






    public render(): JSX.Element {
        return (
            <Card
                className="flex-grow bolt-table-card"
                contentProps={{ contentPadding: false }}
                titleProps={{ text: "Pipelines runs" }}
            >
                <Observer itemProvider={this.itemProvider}>
                    {(observableProps: { itemProvider: ArrayItemProvider<IPipelineItem> }) => (
                        <Table<IPipelineItem>
                            ariaLabel="Pipelines runs"
                            behaviors={[this.sortingBehavior]}
                            className="table-example"
                            columns={this.columns}
                            containerClassName="h-scroll-auto"
                            itemProvider={observableProps.itemProvider}
                            showLines={true}
                            scrollable={true}
                            onSelect={(event, data) => console.log("Selected Row - " + data.index)}
                            onActivate={(event, row) => console.log("Activated Row - " + row.index)}
                        />
                    )}
                </Observer>
            </Card>
        );
    }

    private columns: ITableColumn<IPipelineItem>[] = [
        {
            id: "name",
            name: "Pipeline",
            renderCell: this.renderPipelineColumn,
            readonly: true,
            sortProps: {
                ariaLabelAscending: "Sorted A to Z",
                ariaLabelDescending: "Sorted Z to A",
            },
            width: -20,
        },
        {
            className: "pipelines-two-line-cell",
            id: "lastRun",
            name: "Last run",
            renderCell: this.renderLastRunColumn,
            sortProps: {
                ariaLabelAscending: "Sorted A to Z",
                ariaLabelDescending: "Sorted Z to A",
            },
            width: -46,
        },
        {
            id: "stages",
            ariaLabel: "Stages",
            name: "Stages",
            readonly: true,
            renderCell: this.renderStageColumn,
            sortProps: {
                ariaLabelAscending: "Sorted A to Z",
                ariaLabelDescending: "Sorted Z to A",
            },
            width: -10,
        },
        {
            id: "time",
            ariaLabel: "Time and duration",
            name: "Time and duration",
            readonly: true,
            renderCell: this.renderTimeInformationColumn,
            sortProps: {
                ariaLabelAscending: "Sorted A to Z",
                ariaLabelDescending: "Sorted Z to A",
            },
            width: -20,
        },
        /**
                new ColumnMore(() => {
                    return {
                        id: "sub-menu",
                        items: [
                            { id: "submenu-one", text: "SubMenuItem 1" },
                            { id: "submenu-two", text: "SubMenuItem 2" },
                        ],
                    };
                }),
        */
    ];

    private itemProvider: ObservableValue<ArrayItemProvider<IPipelineItem>> = new ObservableValue<ArrayItemProvider<IPipelineItem>>(new ArrayItemProvider(this.pipelineItems));

    private sortingBehavior = new ColumnSorting<IPipelineItem>(
        (columnIndex: number, proposedSortOrder: SortOrder) => {
            sortItems(
                columnIndex,
                proposedSortOrder,
                this.sortFunctions,
                this.columns,
                this.pipelineItems
            );
            this.itemProvider.value = new ArrayItemProvider(this.pipelineItems);
        }
    );





    private sortFunctions = [
        // Sort on Pipeline column
        (item1: IPipelineItem, item2: IPipelineItem) => {
            return item1.id < item2.id ? -1 : 1;
        },
        // Sort on LastRun column
        (item1: IPipelineItem, item2: IPipelineItem) => {
            let maxDate = new Date(8640000000000000);

            return (item1.lastRunData.startTime ?? maxDate) < (item2.lastRunData.startTime ?? maxDate) ? -1 : 1;
        },
        // Sort on Stages column
        (item1: IPipelineItem, item2: IPipelineItem) => {
            return (buildStatusResultToNumber(item1) < buildStatusResultToNumber(item2) ? -1 : 1);
        },
        // Sort on duration column
        (item1: IPipelineItem, item2: IPipelineItem) => {
            return (item1.lastRunData.duration < item2.lastRunData.duration) ? -1 : 1;
        }
    ];


    private renderPipelineColumn(
        rowIndex: number,
        columnIndex: number,
        tableColumn: ITableColumn<IPipelineItem>,
        tableItem: IPipelineItem
    ): JSX.Element {
        const url = tableItem.url;
        let status = getStatusIndicatorData(tableItem.status, tableItem.result);
        return (
            <SimpleTableCell
                columnIndex={columnIndex}
                tableColumn={tableColumn}
                key={"col-" + columnIndex}
                contentClassName="fontWeightSemiBold font-weight-semibold fontSizeM font-size-m"
            >
                <div className="flex-row wrap-text" >
                    <Link
                        className="fontSizeM font-size-m bolt-table-link bolt-table-cell-content-with-inline-link"
                        tooltipProps={{ text: status.label }}
                        removeUnderline={true}
                        href={url}
                        target={"_parent"}
                    >
                        <div>
                            <Status
                                {...status.statusProps}
                                className="icon-large-margin valign-middle"
                                size={StatusSize.m}
                            />
                            <span>{`${tableItem.name} (#${tableItem.id})`}</span>
                        </div>
                    </Link>
                </div>
            </SimpleTableCell>
        );
    }


    private renderStageColumn(
        rowIndex: number,
        columnIndex: number,
        tableColumn: ITableColumn<IPipelineItem>,
        tableItem: IPipelineItem
    ): JSX.Element {
        const logUrl = tableItem.logUrl;
        let status = getStatusIndicatorData(tableItem.status, tableItem.result);
        return (
            <SimpleTableCell
                columnIndex={columnIndex}
                tableColumn={tableColumn}
                key={"col-" + columnIndex}
                contentClassName="fontWeightSemiBold font-weight-semibold fontSizeL font-size-l"
            >
                <Link
                    className="fontSizeL font-size-l bolt-table-link bolt-table-inline-link"
                    tooltipProps={{ text: status.label }}
                    removeUnderline={true}
                    href={logUrl}
                    target={"_parent"}
                >
                    <Status
                        {...status.statusProps}
                        className="icon-large-margin"
                        size={StatusSize.m}
                    />
                </Link>
            </SimpleTableCell>
        );
    }


    private renderLastRunColumn(
        rowIndex: number,
        columnIndex: number,
        tableColumn: ITableColumn<IPipelineItem>,
        tableItem: IPipelineItem
    ): JSX.Element {
        const { runName, branchName, url, commitData } = tableItem.lastRunData;
        return (
            <TwoLineTableCell
                className="bolt-table-cell-content-with-inline-link no-v-padding"
                key={"col-" + columnIndex}
                columnIndex={columnIndex}
                tableColumn={tableColumn}
                line1={
                    <span className="flex-row wrap-text">
                        <Link
                            className="fontSizeM font-size-m bolt-table-link bolt-table-inline-link"
                            tooltipProps={{ text: runName }}
                            removeUnderline={true}
                            href={url}
                            target={"_parent"}
                        >
                            {runName}
                        </Link>
                    </span>
                }
                line2={
                    <>
                        <span className="fontSizeM font-size-m secondary-text flex-row flex-center">
                            {WithIcon({
                                className: "fontSize font-size bolt-table-two-line-cell-item wrap-text",
                                iconProps: { iconName: "BranchCommit" },
                                children: (
                                    <Link
                                        className="monospaced-text bolt-table-link bolt-table-inline-link"
                                        tooltipProps={{ text: commitData.committer.date.toString() }}
                                        excludeTabStop
                                        href={commitData.commitUrl}
                                        target={"_parent"}
                                    >
                                        {commitData.commitId.substring(0, 8)}
                                    </Link>
                                ),
                                condition: undefined,
                            })}
                            <Link
                                className="monospaced-text bolt-table-link bolt-table-inline-link"
                                tooltipProps={{ text: commitData.committer.email.toString() }}
                                excludeTabStop
                                href={commitData.commitUrl}
                                target={"_parent"}
                            >
                                <div className="persona-content floatright">
                                    <VssPersona
                                        identityDetailsProvider={initialsIdentityProvider(commitData)}
                                        size={"small"}
                                    />
                                    {commitData.committer.name}
                                </div>
                            </Link>
                        </span>
                    </>
                }
            />
        );
    }

    private renderTimeInformationColumn(
        rowIndex: number,
        columnIndex: number,
        tableColumn: ITableColumn<IPipelineItem>,
        tableItem: IPipelineItem
    ): JSX.Element {
        return (
            <TwoLineTableCell
                key={"col-" + columnIndex}
                columnIndex={columnIndex}
                tableColumn={tableColumn}
                line1={WithIcon({
                    className: "fontSize font-size",
                    iconProps: { iconName: "Calendar" },
                    children: (
                        <Ago date={tableItem.lastRunData.startTime!} /*format={AgoFormat.Extended}*/ />
                    ),
                    condition: !(!tableItem.lastRunData.startTime),
                })}
                line2={WithIcon({
                    className: "fontSize font-size bolt-table-two-line-cell-item wrap-text",
                    iconProps: { iconName: "Clock" },
                    children: (
                        <Duration
                            startDate={tableItem.lastRunData.startTime!}
                            endDate={tableItem.lastRunData.endTime}
                        />
                    ),
                    condition: !(!tableItem.lastRunData.startTime),
                })}
            />
        );
    }
}

function WithIcon(props: {
    className?: string;
    iconProps: IIconProps;
    children?: React.ReactNode;
    condition?: boolean;
}): JSX.Element {
    if ((props?.condition ?? true) == true) {
        return (
            <div className={css(props.className, "flex-row flex-center")}>
                {Icon({ ...props.iconProps, className: "icon-margin" })}
                {props.children}
            </div>
        );
    }

    return (
        <div className={css(props.className, "flex-row flex-center")}>
        </div>
    );
}


function initialsIdentityProvider(commitData: any): IIdentityDetailsProvider {
    return ({
        getDisplayName() {
            return commitData.committer.name;
        },
        getIdentityImageUrl(size: number) {
            return undefined;
        }
    });
}


function humanReadableTimeDiff(startDate: Date, endDate: Date, language: string) {
    if (!startDate) {
        return '';
    }

    if (!endDate) {
        endDate = new Date();
    }

    const timeIntervals = [31536000, 2628000, 604800, 86400, 3600, 60, 1];
    const intervalNames = ['year', 'month', 'week', 'day', 'hour', 'minute', 'second'];
    const formatter = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });

    const diff = Math.abs(endDate.getTime() - startDate.getTime()) / 1000;
    const index = timeIntervals.findIndex(i => (diff / i) >= 1);
    const n = Math.floor(diff / timeIntervals[index]);
    const interval: any = intervalNames[index];

    return formatter.format(n, interval);
}


showRootComponent(<PrTabsBuild />);