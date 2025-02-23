import { showRootComponent } from "../Common";

import * as React from "react";
import {
    getStatusIndicatorData,
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
import { PipelinesRestClient } from "azure-devops-extension-api/Pipelines/PipelinesClient";
import { getClient } from 'azure-devops-extension-api'
import { BuildReason, BuildQueryOrder } from "azure-devops-extension-api/Build/Build";


interface IPullRequestTabGroupState {
    projectContext?: IProjectInfo;
    extensionContext?: SDK.IExtensionContext;
    hostContext?: SDK.IHostContext;
    hostNavigationService?: IHostNavigationService;
    accessToken: string;
}

export default class PrTabsBuild extends React.Component<{}, IPullRequestTabGroupState> {

    private pipelineItems: IPipelineItem[] = [];

    constructor(props: {}) {
        super(props);
        this.state = { projectContext: undefined, extensionContext: undefined, hostContext: undefined, hostNavigationService: undefined, accessToken: '' };
    }


    public componentDidMount() {
        try {
            console.log("Component did mount, initializing SDK...");
            SDK.init();

            SDK.ready().then(() => {
                console.log("SDK is ready, loading project context...");
                this.loadProjectContext();
            }).catch((error) => {
                console.error("SDK ready failed: ", error);
            });
        } catch (error) {
            console.error("Error during SDK initialization or project context loading: ", error);
        }
    }


    private async loadProjectContext(): Promise<void> {
        try {
            const hostNavigationService = await SDK.getService<IHostNavigationService>(CommonServiceIds.HostNavigationService);
            const projectClient = await SDK.getService<IProjectPageService>(CommonServiceIds.ProjectPageService);
            const projectContext = await projectClient.getProject();
            const extensionContext = await SDK.getExtensionContext();
            const hostContext = SDK.getHost();
            const accessToken = await SDK.getAccessToken()

            this.setState({ projectContext: projectContext, extensionContext: extensionContext, hostContext: hostContext, hostNavigationService: hostNavigationService, accessToken: accessToken });

            const gitClient = getClient(GitRestClient);
            const buildClient = getClient(BuildRestClient);

            let navRoute = await hostNavigationService.getPageRoute();

            let pullRequestId = Number(navRoute.routeValues.parameters);
            let projectName = navRoute.routeValues.project;
            let gitRepositoryName = navRoute.routeValues.GitRepositoryName;

            let pullRequest = await gitClient.getPullRequestById(pullRequestId, projectName);
            let pullRequestBranch = `refs/pull/${pullRequestId}/merge`;
            let builds = await buildClient.getBuilds(projectName, undefined, undefined, undefined, undefined, undefined, undefined, BuildReason.PullRequest, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, BuildQueryOrder.StartTimeDescending, pullRequestBranch, undefined, pullRequest.repository.id, 'TfsGit');

            let commitIds = builds.map(b => JSON.parse(b.parameters)["system.pullRequest.sourceCommitId"]) as string[];
            let commitsSearchCriteria: any = { ids: commitIds };

            var commitsDictionary: { [details: string]: any } = {}
            var commits = await gitClient.getCommits(pullRequest.repository.id, commitsSearchCriteria);
            commits.forEach((c, index) => commitsDictionary[c.commitId] = c);

            debugger;

            if (builds?.length>0) {
                this.pipelineItems = builds.map(b => {
                    var commitData = commitsDictionary[JSON.parse(b.parameters)["system.pullRequest.sourceCommitId"]];
                    commitData.commitUrl = `https://dev.azure.com/${this.state.hostContext?.name}/${this.state.projectContext?.name}/_git/${b.repository.name}/commit/${commitData.commitId}?refName=${pullRequest.sourceRefName}`;

                    return {
                        favorite: new ObservableValue<boolean>(true),
                        lastRunData: {
                            branchName: pullRequest.sourceRefName.replace("refs/heads/", ""),
                            prId: pullRequestId,
                            runName: `#${b.buildNumber} \u00b7 ${commitData.comment}`,
                            startTime: b.startTime,
                            endTime: b.finishTime,
                            duration: humanReadableTimeDiff(b.startTime, b.finishTime, 'en'),
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
            this.itemProvider.notify(this.itemProvider.value, "newData")

            SDK.notifyLoadSucceeded();
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
            
            width: -46,
        },
        {
            id: "stages",
            ariaLabel: "Stages",
            name: "Stages",
            readonly: true,
            renderCell: this.renderStageColumn,
            width: -10,
        },
        {
            id: "time",
            ariaLabel: "Time and duration",
            name: "Time and duration",
            readonly: true,
            renderCell: this.renderTimeInformationColumn,
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
            this.pipelineItems =
                sortItems(
                    columnIndex,
                    proposedSortOrder,
                    this.sortFunctions,
                    this.columns,
                    this.pipelineItems
                );
        }
    );


    private sortFunctions = [
        // Sort on Name column
        (item1: IPipelineItem, item2: IPipelineItem) => {
            return item1.name.localeCompare(item2.name!);
        },
    ];


    private renderPipelineColumn(
        rowIndex: number,
        columnIndex: number,
        tableColumn: ITableColumn<IPipelineItem>,
        tableItem: IPipelineItem
    ): JSX.Element {
        const url = tableItem.url;
        return (
            <SimpleTableCell
                columnIndex={columnIndex}
                tableColumn={tableColumn}
                key={"col-" + columnIndex}
                contentClassName="fontWeightSemiBold font-weight-semibold fontSizeM font-size-m" 
            >
                <Status
                    {...getStatusIndicatorData(tableItem.status, tableItem.result).statusProps}
                    className="icon-large-margin"
                    size={StatusSize.m}
                />
                <div className="flex-row wrap-text">
                    <Tooltip overflowOnly={true}>
                        <Link
                            className="fontSizeM font-size-m bolt-table-link bolt-table-cell-content-with-inline-link"
                            removeUnderline = {true}
                            onClick={(e) => parent.location.href = url}
                        >
                            {`${tableItem.name} (#${tableItem.id})`}
                        </Link>
                    </Tooltip>
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
        return (
            <SimpleTableCell
                columnIndex={columnIndex}
                tableColumn={tableColumn}
                key={"col-" + columnIndex}
                contentClassName="fontWeightSemiBold font-weight-semibold fontSizeL font-size-l"
            >
                        <Link
                            className="fontSizeL font-size-l bolt-table-link bolt-table-inline-link"
                            removeUnderline = {true}
                            onClick={(e) => parent.location.href = logUrl}
                        >
                <Status
                    {...getStatusIndicatorData(tableItem.status, tableItem.result).statusProps}
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
                        <Tooltip text={runName} overflowOnly>
                            <Link
                                className="fontSizeM font-size-m bolt-table-link bolt-table-inline-link"
                                removeUnderline = {true}
                                onClick={ (e) => parent.location.href = url }
                            >
                                {runName}
                            </Link>
                        </Tooltip>
                    </span>
                }
                line2={
                   <>
                     <span className="fontSizeM font-size-m secondary-text flex-row flex-center">
                        <Tooltip text={commitData.committer.date} overflowOnly>
                            <Link
                                className="monospaced-text bolt-table-link bolt-table-inline-link"
                                excludeTabStop
                                onClick={(e) => parent.location.href = commitData.commitUrl}
                            >
                            {WithIcon({
                                className: "fontSize font-size bolt-table-two-line-cell-item wrap-text",
                                iconProps: { iconName: "BranchCommit" },
                                children: (
                                    commitData.commitId.substring(0,8)
                                ),
                            })}
                               
                            </Link>
                        </Tooltip>
                        <VssPersona
                            identityDetailsProvider={initialsIdentityProvider(commitData)}
                            size={"small"}
                        />
                        &nbsp;{commitData.committer.name}
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
                })}
            />
        );
    }
}

function WithIcon(props: {
    className?: string;
    iconProps: IIconProps;
    children?: React.ReactNode;
}): JSX.Element {
    return (
        <div className={css(props.className, "flex-row flex-center")}>
            {Icon({ ...props.iconProps, className: "icon-margin" })}
            {props.children}
        </div>
    );
}


function initialsIdentityProvider(commitData:any): IIdentityDetailsProvider {
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