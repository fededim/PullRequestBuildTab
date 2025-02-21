import { showRootComponent } from "../Common";

import * as React from "react";
import {
    getStatusIndicatorData,
    IPipelineItem,
    PipelineStatus,
    ReleaseType,
    ReleaseTypeText,
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
import { Ago } from "azure-devops-ui/Ago";
import { Duration } from "azure-devops-ui/Duration";
import { Tooltip } from "azure-devops-ui/TooltipEx";
import { css } from "azure-devops-ui/Util";
import { ArrayItemProvider } from "azure-devops-ui/Utilities/Provider";
import { ObservableValue } from "azure-devops-ui/Core/Observable";
import { Observer } from "azure-devops-ui/Observer";

import { CommonServiceIds, IProjectPageService, IVssRestClientOptions, IHostNavigationService } from "azure-devops-extension-api";
import { BuildRestClient } from "azure-devops-extension-api/Build/BuildClient";
import { GitRestClient } from "azure-devops-extension-api/Git/GitClient";
import { PipelinesRestClient } from "azure-devops-extension-api/Pipelines/PipelinesClient";
import { getClient } from 'azure-devops-extension-api'
import { BuildReason } from "azure-devops-extension-api/Build/Build";


interface IPullRequestTabGroupState {
    projectContext: any;
    extensionContext: any;
    accessToken: string;
}

export default class PrTabsBuild extends React.Component<{}, IPullRequestTabGroupState> {

    constructor(props: {}) {
        super(props);
        this.state = { projectContext: undefined, extensionContext: undefined, accessToken: '' };
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

    runs: any = undefined;

    private async loadProjectContext(): Promise<void> {
        try {
            const projectClient = await SDK.getService<IProjectPageService>(CommonServiceIds.ProjectPageService);
            const hostClient = await SDK.getService<IHostNavigationService>(CommonServiceIds.HostNavigationService);
            const projectContext = await projectClient.getProject();
            const extensionContext = SDK.getExtensionContext();
            const accessToken = await SDK.getAccessToken()

            this.setState({ projectContext: projectContext, extensionContext: extensionContext, accessToken: accessToken });

            // let workItemFormService = await SDK.getService<IWorkItemFormService>(WorkItemTrackingServiceIds.WorkItemFormService);
            //const options: IVssRestClientOptions = new VssRestClientOptions {  }
            //const pipelinesClient = getClient(PipelinesRestClient);
            const gitClient = getClient(GitRestClient);
            const buildClient = getClient(BuildRestClient);

            let navRoute = await hostClient.getPageRoute();

            let pullRequestId = Number(navRoute.routeValues.parameters);
            let projectName = navRoute.routeValues.project;
            let gitRepositoryName = navRoute.routeValues.GitRepositoryName;

            let pullRequest = await gitClient.getPullRequestById(pullRequestId, projectName);
            let pullRequestBranch = `refs/pull/${pullRequestId}/merge`;
            let builds = await buildClient.getBuilds(projectName, undefined, undefined, undefined, undefined, undefined, undefined, BuildReason.PullRequest, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, pullRequestBranch, undefined, pullRequest.repository.id, 'TfsGit');


            let commitIds = builds.map(b => JSON.parse(b.parameters)["system.pullRequest.sourceCommitId"]) as string[];
            let commitsSearchCriteria: any = { ids: commitIds };

            var commitsDictionary: { [details: string]: any } = {}
            var commits = await gitClient.getCommits(pullRequest.repository.id, commitsSearchCriteria);
            commits.forEach((c, index) => commitsDictionary[c.commitId] = c);


            // let runs = await pipelinesClient.listPipelines(projectName, '1');

            pipelineItems = builds.map(b => {

                return {
                    favorite: new ObservableValue<boolean>(true),
                    lastRunData: {
                        branchName: pullRequest.sourceRefName.replace("refs/heads/", ""),
                        endTime: b.finishTime,
                        prId: pullRequestId,
                        prName: `#${b.buildNumber} - ${commitsDictionary[JSON.parse(b.parameters)["system.pullRequest.sourceCommitId"]].comment}`,
                        releaseType: ReleaseType.tag,
                        startTime: b.startTime,
                    },
                    name: b.definition.name,
                    status: PipelineStatus.running
                };
            }) as IPipelineItem[];

            this.itemProvider.notify(new ArrayItemProvider(pipelineItems), "newData")

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
                titleProps={{ text: "All pipelines" }}
            >
                <Observer itemProvider={this.itemProvider}>
                    {(observableProps: { itemProvider: ArrayItemProvider<IPipelineItem> }) => (
                        <Table<IPipelineItem>
                            ariaLabel="Advanced table"
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
            renderCell: renderNameColumn,
            readonly: true,
            sortProps: {
                ariaLabelAscending: "Sorted A to Z",
                ariaLabelDescending: "Sorted Z to A",
            },
            width: -33,
        },
        {
            className: "pipelines-two-line-cell",
            id: "lastRun",
            name: "Last run",
            renderCell: renderLastRunColumn,
            width: -46,
        },
        {
            id: "time",
            ariaLabel: "Time and duration",
            readonly: true,
            renderCell: renderDateColumn,
            width: -20,
        },
        new ColumnMore(() => {
            return {
                id: "sub-menu",
                items: [
                    { id: "submenu-one", text: "SubMenuItem 1" },
                    { id: "submenu-two", text: "SubMenuItem 2" },
                ],
            };
        }),
    ];

    private itemProvider: ObservableValue<ArrayItemProvider<IPipelineItem>> = new ObservableValue<ArrayItemProvider<IPipelineItem>>(new ArrayItemProvider(pipelineItems));

    private sortingBehavior = new ColumnSorting<IPipelineItem>(
        (columnIndex: number, proposedSortOrder: SortOrder) => {
            pipelineItems = 
                sortItems(
                    columnIndex,
                    proposedSortOrder,
                    this.sortFunctions,
                    this.columns,
                    pipelineItems
                );
        }
    );

    private sortFunctions = [
        // Sort on Name column
        (item1: IPipelineItem, item2: IPipelineItem) => {
            return item1.name.localeCompare(item2.name!);
        },
    ];
}

function renderNameColumn(
    rowIndex: number,
    columnIndex: number,
    tableColumn: ITableColumn<IPipelineItem>,
    tableItem: IPipelineItem
): JSX.Element {
    return (
        <SimpleTableCell
            columnIndex={columnIndex}
            tableColumn={tableColumn}
            key={"col-" + columnIndex}
            contentClassName="fontWeightSemiBold font-weight-semibold fontSizeM font-size-m"
        >
            <Status
                {...getStatusIndicatorData(tableItem.status).statusProps}
                className="icon-large-margin"
                size={StatusSize.l}
            />
            <div className="flex-row wrap-text">
                <Tooltip overflowOnly={true}>
                    <span>{tableItem.name}</span>
                </Tooltip>
            </div>
        </SimpleTableCell>
    );
}

function renderLastRunColumn(
    rowIndex: number,
    columnIndex: number,
    tableColumn: ITableColumn<IPipelineItem>,
    tableItem: IPipelineItem
): JSX.Element {
    const { prName, prId, releaseType, branchName } = tableItem.lastRunData;
    const text = "#" + prId + " \u00b7 " + prName;
    const releaseTypeText = ReleaseTypeText({ releaseType: releaseType });
    return (
        <TwoLineTableCell
            className="bolt-table-cell-content-with-inline-link no-v-padding"
            key={"col-" + columnIndex}
            columnIndex={columnIndex}
            tableColumn={tableColumn}
            line1={
                <span className="flex-row wrap-text">
                    <Tooltip text={text} overflowOnly>
                        <Link
                            className="fontSizeM font-size-m bolt-table-link bolt-table-inline-link"
                            excludeTabStop
                            href="#pr"
                        >
                            {text}
                        </Link>
                    </Tooltip>
                </span>
            }
            line2={
                <span className="fontSize font-size secondary-text flex-row flex-center">
                    {ReleaseTypeIcon({ releaseType: releaseType })}
                    <Tooltip text={releaseTypeText} overflowOnly>
                        <span key="release-type-text" style={{ flexShrink: 10 }}>
                            {releaseTypeText}
                        </span>
                    </Tooltip>
                    <Tooltip text={branchName} overflowOnly>
                        <Link
                            className="monospaced-text bolt-table-link bolt-table-inline-link"
                            excludeTabStop
                            href="#branch"
                        >
                            {Icon({
                                className: "icon-margin",
                                iconName: "OpenSource",
                                key: "branch-name",
                            })}
                            {branchName}
                        </Link>
                    </Tooltip>
                </span>
            }
        />
    );
}

let pipelineItems: IPipelineItem[] = [
    {
        favorite: new ObservableValue<boolean>(true),
        lastRunData: {
            branchName: "main",
            endTime: modifyNow(0, -1, 23, 8),
            prId: 482,
            prName: "Added testing for get_service_instance_stats",
            releaseType: ReleaseType.prAutomated,
            startTime: modifyNow(0, -1, 0, 0),
        },
        name: "enterprise-distributed-service",
        status: PipelineStatus.running,
    },
    {
        favorite: new ObservableValue<boolean>(true),
        lastRunData: {
            branchName: "main",
            endTime: modifyNow(-1, 0, 5, 2),
            prId: 137,
            prName: "Update user service",
            releaseType: ReleaseType.tag,
            startTime: modifyNow(-1, 0, 0, 0),
        },
        name: "microservice-architecture",
        status: PipelineStatus.succeeded,
    },
    {
        favorite: new ObservableValue<boolean>(false),
        lastRunData: {
            branchName: "main",
            endTime: modifyNow(0, -2, 33, 1),
            prId: 32,
            prName: "Update user service",
            releaseType: ReleaseType.scheduled,
            startTime: modifyNow(0, -2, 0, 0),
        },
        name: "mobile-ios-app",
        status: PipelineStatus.succeeded,
    },
    {
        favorite: new ObservableValue<boolean>(false),
        lastRunData: {
            branchName: "test",
            endTime: modifyNow(0, -4, 4, 17),
            prId: 385,
            prName: "Add a request body validator",
            releaseType: ReleaseType.prAutomated,
            startTime: modifyNow(0, -4, 0, 0),
        },
        name: "node-package",
        status: PipelineStatus.succeeded,
    },
    {
        favorite: new ObservableValue<boolean>(false),
        lastRunData: {
            branchName: "dev",
            endTime: modifyNow(0, -6, 2, 8),
            prId: 792,
            prName: "Clean up notifications styling",
            releaseType: ReleaseType.manual,
            startTime: modifyNow(0, -6, 0, 0),
        },
        name: "parallel-stages",
        status: PipelineStatus.failed,
    },
    {
        favorite: new ObservableValue<boolean>(false),
        lastRunData: {
            branchName: "padding-1",
            endTime: modifyNow(-2, 0, 49, 52),
            prId: 283,
            prName: "Add extra padding on cells",
            releaseType: ReleaseType.prAutomated,
            startTime: modifyNow(-2, 0, 0, 0),
        },
        name: "simple-web-app",
        status: PipelineStatus.warning,
    },
];


function renderDateColumn(
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

function modifyNow(days: number, hours: number, minutes: number, seconds: number): Date {
    const now = new Date();
    const newDate = new Date(now as any);
    newDate.setDate(now.getDate() + days);
    newDate.setHours(now.getHours() + hours);
    newDate.setMinutes(now.getMinutes() + minutes);
    newDate.setSeconds(now.getSeconds() + seconds);
    return newDate;
}


function WithIcon(props: {
    className?: string;
    iconProps: IIconProps;
    children?: React.ReactNode;
}) {
    return (
        <div className={css(props.className, "flex-row flex-center")}>
            {Icon({ ...props.iconProps, className: "icon-margin" })}
            {props.children}
        </div>
    );
}

function ReleaseTypeIcon(props: { releaseType: ReleaseType }) {
    let iconName: string = "";
    switch (props.releaseType) {
        case ReleaseType.prAutomated:
            iconName = "BranchPullRequest";
            break;
        default:
            iconName = "Tag";
    }

    return Icon({
        className: "bolt-table-inline-link-left-padding icon-margin",
        iconName: iconName,
        key: "release-type",
    });
}

showRootComponent(<PrTabsBuild />);