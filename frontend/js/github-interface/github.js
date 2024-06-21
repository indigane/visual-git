import { parseFullRefPath } from '../git-interface/parsers.js';
import Commit from '../models/commit.js';
import Reference from '../models/reference.js';
import { splitOnce } from '../utils.js';


async function apiRequest(url) {
  const response = await fetch(url);
  return await response.json();
}


const apiRequestMemoryCache = {};
async function memoryCachedApiRequest(url) {
  if (url in apiRequestMemoryCache) {
    return apiRequestMemoryCache[url];
  }
  const responseData = await apiRequest(url);
  apiRequestMemoryCache[url] = responseData;
  return responseData;
}


async function storageCachedApiRequest(url) {
  const jsonString = localStorage.getItem(url);
  if (jsonString !== null) {
    return JSON.parse(jsonString);
  }
  const responseData = await apiRequest(url);
  localStorage.setItem(url, JSON.stringify(responseData));
  return responseData;
}


function commitFromCommitData(commitData) {
  const [subject, messageBody] = splitOnce(commitData.commit.message, '\n\n');
  const commit = new Commit({
    id: commitData.sha,
    parents: commitData.parents.map(parent => parent.sha),
    authorName: commitData.commit.author.name,
    authorEmail: commitData.commit.author.email,
    authorDate: new Date(commitData.commit.author.date),
    committerName: commitData.commit.committer.name,
    committerEmail: commitData.commit.committer.email,
    committerDate: new Date(commitData.commit.committer.date),
    subject,
    messageBody,
  });
  return commit;
}


/**
 * @typedef {Object} GithubOptions
 * @property {'currentBranch' | 'allRefs' | 'allRefsHistory'} commitVisibility
 * @property {number} maxCommits
 */
/**
 * @typedef {Object} GithubArgs
 * @property {string} repositoryOwner
 * @property {string} repositoryName
 * @property {GithubOptions} options
 * @property {Object.<string, Reference>} [refs]
 * @property {Commit[]} [commits]
 */
/** @param {GithubArgs} args */
export async function getCommitsAndRefs(args) {
  const { options } = args;
  const [refs, commits] = await Promise.all([getRefs(args), getCommits(args)]);
  if (options.commitVisibility === 'allRefs') {
    const additionalCommits = await getCommitsFromActivities({ ...args, refs, commits });
    commits.push(...additionalCommits);
    commits.sort((a, b) => b.committerDate.getTime() - a.committerDate.getTime());
  }
  return { commits, refs };
}


/** @param {GithubArgs} args */
export async function getCommits({ repositoryOwner, repositoryName }) {
  /** @type {Commit[]} */
  const commits = [];
  // Two pages are requested for now, since getCommitsFromActivities can include page two commits from the default branch.
  const pageCount = 2;
  let pageRequests = [];
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
    pageRequests.push(
      memoryCachedApiRequest(`https://api.github.com/repos/${repositoryOwner}/${repositoryName}/commits?per_page=100&page=${pageNumber}`)
    );
  }
  const commitsDataPages = await Promise.all(pageRequests);
  for (const commitsData of commitsDataPages) {
    for (const commitData of commitsData) {
      commits.push(commitFromCommitData(commitData));
    }
  }
  return commits;
}


/** @param {GithubArgs} args */
export async function getCommitsFromActivities({ repositoryOwner, repositoryName, options, refs, commits }) {
  /** @type {Commit[]} */
  const additionalCommits = [];
  const commitsLength = commits.length;
  const alreadyFetchedCommitIds = commits.map(commit => commit.id);
  const refsCommitIds = Object.values(refs).map(ref => ref.commitId);
  const activitiesData = await memoryCachedApiRequest(`https://api.github.com/repos/${repositoryOwner}/${repositoryName}/activity?per_page=100`);
  for (const activityData of activitiesData) {
    const commitId = activityData.after;
    if (activityData.activity_type === 'branch_deletion') {
      // TODO: For allRefsHistory we want this.
      continue;
    }
    if (alreadyFetchedCommitIds.includes(commitId)) {
      continue;
    }
    if ( ! refsCommitIds.includes(commitId)) {
      // TODO: For allRefsHistory we want this.
      continue;
    }
    const activityCommitsData = await storageCachedApiRequest(`https://api.github.com/repos/${repositoryOwner}/${repositoryName}/commits?sha=${commitId}&per_page=100`);
    for (const commitData of activityCommitsData) {
      if (alreadyFetchedCommitIds.includes(commitData.sha)) {
        continue;
      }
      const commit = commitFromCommitData(commitData);
      additionalCommits.push(commit);
      alreadyFetchedCommitIds.push(commit.id);
    }
    if (commitsLength + additionalCommits.length >= options.maxCommits) {
      break;
    }
  }
  return additionalCommits;
}


/** @param {GithubArgs} args */
export async function getTags({ repositoryOwner, repositoryName }) {
  /** @type {Object.<string, Reference>} A mapping of refs with `fullRefPath` as the keys */
  const refs = {};
  const tagsData = await memoryCachedApiRequest(`https://api.github.com/repos/${repositoryOwner}/${repositoryName}/tags?per_page=100`);
  for (const tagData of tagsData) {
    const fullRefPath = `refs/tags/${tagData.name}`;
    const commitId = tagData.commit.sha;
    const refType = 'tags';
    const refName = tagData.name;
    refs[fullRefPath] = new Reference({ fullRefPath, commitId, refType, refName });
  }
  return refs;
}


/** @param {GithubArgs} args */
export async function getBranches({ repositoryOwner, repositoryName }) {
  /** @type {Object.<string, Reference>} A mapping of refs with `fullRefPath` as the keys */
  const refs = {};
  const refsData = await memoryCachedApiRequest(`https://api.github.com/repos/${repositoryOwner}/${repositoryName}/git/matching-refs/heads`);
  for (const refData of refsData) {
    let commitId;
    if (refData.object.type === 'commit') {
      commitId = refData.object.sha;
    }
    else {
      continue;
    }
    const fullRefPath = refData.ref;
    const { refType, refName } = parseFullRefPath(fullRefPath);
    refs[fullRefPath] = new Reference({ fullRefPath, commitId, refType, refName });
  }
  return refs;
}


/** @param {GithubArgs} args */
export async function getRefs(args) {
  const [tags, branches] = await Promise.all([getTags(args), getBranches(args)]);
  const refs = { ...tags, ...branches };
  return refs;
}
