# FixCache

**FixCache** is a github app implementation of [FixCache](https://people.csail.mit.edu/hunkim/images/3/37/Papers_kim_2007_bugcache.pdf) with git commit history. 

It provides code reviewers with information about probable bug introducing files updated in a pull request based on previous commits.

The prediction algorithm is executed over the commit history of the project, keeping track of the most fault-prone error files. The paper assumes four kinds of localities that bug occurences occur in:

- *Changed-entity locality* : if an entity was changed recently, it will tend to introduce faults soon
- *new-entity locality*: if an entity has been added recently, it will tend to introduce faults soon
- *temporal locality*: if an entity introduced a fault recently, it will tend to introduce other faults soon
- *spatial locality*: if an entity introduced a fault recently, "nearby" entities will also tend to introduce faults soon

- [Installation](#Installation)
- [Permissions](#Permissions)
- [Configuration](#Configuration)
- [How it works](#How-it-works)
- [Deploying your own FixCache](#Deploying-your-own-fixCache)


## Installation

- Install it to your repositories from [here](https://github.com/apps/fixcache)

## Permissions

### Repository permissions

The app has access to the following repository permissions:

- *Contents*: `Read-only` 
- *Metadata* : `Read-only`
- *Pull requests*: `Read & write`

### Events

The app is subscribed to the following events:

- `Pull request` 
- `Push`


## Configuration

The app (for now) uses a `.env` file for configuration. A sample config is shown in `env.sample`.

### Github config

- `GITHUB_APP_ID` : the github application id
- `PRIVATE_KEY_PATH`: the path to the private key 
- `WEBHOOK_SECRET`: the webhook secret for the app's webhook 

### Fix cache config

- `CACHE_SIZE`: the size of the fix cache i.e number of files stored in the cache 
- `HISTORY_SIZE`: the number of days to load commit history from on installation
- `FIX_KEY_WORDS`: Keywords in a fix commit eg. fix,fixed
- `TRACKED_BRANCH`: the main branch to track pushes on
- `SKIP_PATHS`: paths to skip/not store in the fix cache like test files

### Default

Following default values are used in the current version of the app: 

- `CACHE_SIZE`: `25` 
- `HISTORY_SIZE`: `30`
- `FIX_KEY_WORDS`: `fix`
- `TRACKED_BRANCH`: `master`
- `SKIP_PATHS`: `test`

For now, if this configuration is not suitable for your repositories, you can [deploy your own FixCache](#Deploying-your-own-fixCache) with the required configuration. 

## How it works

- FixCache keeps track of bug fix commits pushed to the `tracked-branch` of a repository and maintains a fix-sized cache of file entities related to bug fixes. The bug fix commits are identified by the `fix keywords` provided in the configuration. 
 
- On pull requests, it fetches the cache and updates the pull requests with information about the files present if th pull request updates these files. 
    - it adds a label `Fix Cache` to the pull request.
    - it adds a comment with the filenames present in the cache and the respective number of cache hits.

## Deploying your own fixCache

FixCache is deployed on [Deta micros](https://deta.sh). The following steps show how to deploy your own FixCache as a github app with custom configuration.

### Clone the repository 

- Clone the repository with `git clone https://github.com/aavshr/fixCache.git`.

### Deploy on Deta

This deployment is for [Deta micros](https://deta.sh). You will need to have signed up for deta and the deta cli installed.

If you want to deploy on another platform, you will need to modify the code slightly and then set up the respective configuration for deployment to other platforms.    

- After you have cloned the repository, change the directory to the cloned directory and enter in your terminal

```shell
$ deta new
```

You should see the output that the application has been created and the dependencies have been installed. 

- After installing the app, enter 

```shell
$ deta details
```

You should see details about your application in your output. The `endpoint` shown will be needed later to add as the webhook url in our github app. 

- Lastly disable auth by entering:

```shell
$ deta auth disable
```

We will use a webhook secret to verify that the events are coming from github on our webhook endpoint.

### Create a github app

A comprehensive guide on creating a github app is available [here](https://docs.github.com/en/developers/apps/building-github-apps). 

- Go to your *developer settings* (it's under *settings* on the dropdown menu when you click your profile on github) and create a new github app. Provide a name (and description if you want). 

### Setting up the webhook

In *Webhook URL*, type the *endpoint* from the output to `deta details`. 

Generate a long secure random string (there are services online that do this) and use that as the *Webhook Secret*. Keep hold of this secret as you will need it to set up the configuration later.

### Permissions and Events

When choosing the permissions for the app, you will need to provide the app with following *repository permissions*:

- *Contents*: `Read-only` 
- *Metadata* : `Read-only`
- *Pull requests*: `Read & write`

The app is subscribed to the following events:

- `Pull request` 
- `Push`

### Generate the private key

After creating the github app, go to your app's *General* settings and generate a private key. 

Save the private key in the your cloned directory in a file. This is required for authentication. 

Make sure you **do not commit** this file to a public repository. 

### Configure the app

App configuration (for now) is simply done through environment variables. Create a new file `.env` in the cloned directory and provide it with the following variables. 
A sample `env.sample` is present in the repository to see the format of the file. Make sure you **do not expose** your `.env` file publicly.

- `GITHUB_APP_ID` : the github app id, you can find this in your github app's general settings.
- `PRIVATE_KEY_PATH`: the path to the private key file you saved in the earlier step. 
- `WEBHOOK_SECRET`: the webhook secret for the app's webhook 
- `CACHE_SIZE`: the size of the fix cache i.e number of files stored in the cache 
- `HISTORY_SIZE`: the number of days to load commit history from on installation
- `FIX_KEY_WORDS`: Keywords in a fix commit separated by commas eg. fix,fixed
- `TRACKED_BRANCH`: the main branch to track pushes on
- `SKIP_PATHS`: paths to skip/not store in the fix cache like test files

### Deploy the changes and the configuration

First change the directory to the root of the cloned directory (if you are not there already) and deploy the changes with,

```shell
$ deta deploy
```

Next, deploy the configuration in the `.env` with,

```shell
$ deta update -e .env
```

You should see that the environment variables have been successfully updated.

### Install

The app should be ready now to accept incoming requests. You can install the app to your repositories in the *Install App* page of your github app.