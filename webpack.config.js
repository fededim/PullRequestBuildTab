const path = require("path");
const fs = require("fs");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const entries = {};
const srcDir = path.join(__dirname, "src");

fs.readdirSync(srcDir)
    .filter(dir => fs.statSync(path.join(srcDir, dir)).isDirectory())
    .forEach(dir => (entries[dir] = "./" + path.join("src", dir, dir)));

module.exports = {
    target: "web",
    entry: entries,
    output: {
        filename: "[name]/[name].js",
    },
    devtool: "inline-source-map",
    devServer: {
        server: {
            type: "https",
            options: {
                ca: 'C:\Users\PO\source\repos\PullRequestBuildsTab\node_modules\.cache\webpack-dev-server\IIS.pem'
            }
        },
        port: 3000,
        static: {
            directory: path.join(__dirname, "dist"),
        }
    },
    resolve: {
        extensions: [".ts", ".tsx", ".js"],
        alias: {
            "azure-devops-extension-sdk": path.resolve(
                "node_modules/azure-devops-extension-sdk"
            )
        }
    },
    stats: {
        warnings: false
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: "ts-loader"
            },
            {
                test: /\.scss$/,
                use: [
                    // Creates `style` nodes from JS strings
                    "style-loader",
                    // Translates CSS into CommonJS
                    "css-loader",
                    // Azure Devops variables
                    "azure-devops-ui/buildScripts/css-variables-loader",
                    // Compiles Sass to CSS
                    {
                        loader: 'sass-loader',
                        options: {
                            sassOptions: {
                                quietDeps: true
                            }
                        }
                    }]
            },
            {
                test: /\.css$/,
                use: ["style-loader", "css-loader"]
            },
            {
                test: /\.woff2?$/i,
                type: 'asset/resource',
                dependency: { not: ['url'] }
            },
            {
                test: /\.html$/,
                use: "file-loader"
            }
        ]
    },
    plugins: [new CopyWebpackPlugin({
        patterns: [
            { from: "**/*.html", context: "src" }
        ]
    })]
};
