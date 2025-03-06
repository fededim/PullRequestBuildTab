# PullRequestsBuildsTab extension

This Azure Devops extension adds a **Builds** tab to every pull request which lists all the builds generated by the continuous integration since the creation of the pull request.

# Reasons which led to the creation of this extension
In my work experience I worked with both Azure Devops and Jenkins pipelines and, while I like Azure Devops mostly (it is a fully integrated tool), there was a feature from Jenkins which I liked and was missing, e.g. the [Stage View](https://plugins.jenkins.io/pipeline-stage-view/) : a table resuming the history of all the builds and their outcomes generated by the continuous integration since the creation of the pull request.

# What is inside the new Builds tab

This tab is inspired to **Azure Devops Build runs** and it contains a simple grid with one row for every integration build generated since the creation fo the pull request made up of these columns:
-   **Pipeline**: this column contains the Azure Devops Pipeline triggered by the continous integration including its id. This grid cell is clickable and you will be redirected to all builds runs of this pipeline.
-   **Last run**: this column is made of two rows:
    - The upper one contains the build number and the commit message of the commit which triggered the build. This cell is clickable and you will be redirected to the results of the build run.
    - The lower one contains the id of the commit which triggered the build and the user who performed the commit. This cell is clickable and you will be redirected to the detail of the commit.
-   **Stages**: this column contains a clickable the result of the build and it is clickable with a hyperlink to build logs.
-   **Time and duration**: this column contains the build start time, end time and duration in a human readable format.

Features:
- The grid is scrollable
- You can sort any of the four columns in ascending or descending order.
- Most of the cells have also a tooltip.
- This tab supports autorefresh, e.g. whenever a new commit is pushed to the pull request branch thanks to its integration with Azure Devops SignalR websocket events.

# Version history

**0.1.0-0.1.2**: Initial preview versions
- Known bugs:
    - The extensions is working fine, yet there are still some inconsistencies in the user interface, notwithstanding the fact I used the [Azure Devops global styles provided by the documentation](https://developer.microsoft.com/it-it/azure-devops/develop/extensions).
    - The column sorting must be fixed.

**0.1.3**: (officially it did not work, probably to wrong extension packaging setting in manifest)
- added autorefresh on pushes to pull request source branch using SignalR events
- minor bugfixes on code and ui

**1.0.0**: First official version
- fixed styles
- fixed column sorting
- improved hyperlinks  (now they support CTRL key to open them in a new tab)
- added grid scrolling
- added further screenshots
