import { parseFullRefPath } from '../git-interface/parsers.js';
import Commit from '../models/commit.js';
import Reference from '../models/reference.js';
import { splitOnce } from '../utils.js';


/** @returns {Promise<{ headers: Object, data: any }>} */
async function apiRequest(url) {
  const response = await fetch(url);
  return {
    headers: Object.fromEntries(response.headers.entries()),
    data: await response.json(),
  };
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


function parseLinkHeader(linkHeaderValue) {
  if ( ! linkHeaderValue) {
    return {};
  }
  const links = {};
  const parts = linkHeaderValue.split(', ');
  for (const part of parts) {
    const [ urlPart, namePart ] = part.split('; ');
    const url = urlPart.replace(/<(.*)>/, '$1').trim();
    const name = namePart.replace(/rel="(.*)"/, '$1').trim();
    links[name] = url;
  }
  return links;
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


export class GithubProvider {
  /**
   * @typedef {Object} GithubOptions
   * @property {'currentBranch' | 'allRefs' | 'allRefsHistory'} commitVisibility
   * @property {number} commitPageSize
   */
  /**
   * @param {object} args
   * @param {string} args.repositoryOwner
   * @param {string} args.repositoryName
   * @param {GithubOptions} args.options
   */
  constructor({ repositoryOwner, repositoryName, options }) {
    this.repositoryOwner = repositoryOwner;
    this.repositoryName = repositoryName;
    this.options = options;
    this._refs = {};
    this._commits = [];
    this._commitsPaginationStart = null;
    this._commitsPaginationPage = 0;
    this._commitsPaginationIsLast = false;
    this._includeActivities = options.commitVisibility === 'allRefs';
    this._activitiesPaginationCursor = null;
    this._activitiesPaginationIsLast = false;
  }

  async getInitial() {
    const { options } = this;
    const [ refs, commits ] = await Promise.all([this.getRefs(), this.getCommits()]);
    this._refs = refs;
    this._commits = commits;
    this._commitsPaginationStart = commits[0]?.id ?? null;
    if (this._includeActivities) {
      const { additionalCommits, nextCursor } = await this.getCommitsFromActivities();
      this._activitiesPaginationCursor = nextCursor;
      if (nextCursor === null) {
        this._activitiesPaginationIsLast = true;
      }
      this._commits.push(...additionalCommits);
      this._commits.sort((a, b) => b.committerDate.getTime() - a.committerDate.getTime());
    }
    return { commits, refs };
  }

  async getWithNext() {
    if (this._commits.length === 0) {
      return await this.getInitial();
    }
    if (this._commitsPaginationIsLast && this._activitiesPaginationIsLast) {
      return { commits: this._commits, refs: this._refs };
    }
    if ( ! this._commitsPaginationIsLast) {
      const nextCommits = await this.getCommits();
      this._commits.push(...nextCommits);
    }
    if ( ! this._activitiesPaginationIsLast && this._includeActivities) {
      const { additionalCommits, nextCursor } = await this.getCommitsFromActivities();
      this._activitiesPaginationCursor = nextCursor;
      if (nextCursor === null) {
        this._activitiesPaginationIsLast = true;
      }
      this._commits.push(...additionalCommits);
    }
    // Commits are already sorted unless commits from activities are mixed in.
    if (this._includeActivities) {
      this._commits.sort((a, b) => b.committerDate.getTime() - a.committerDate.getTime());
    }
    return { commits: this._commits, refs: this._refs };
  }

  async getCommits() {
    const { repositoryOwner, repositoryName, _commitsPaginationStart: startCommitId, _commitsPaginationPage: currentPage } = this;
    /** @type {Commit[]} */
    const commits = [];
    // Two pages are requested for now, since getCommitsFromActivities can include page two commits from the default branch.
    const pageCount = 2;
    let pageRequests = [];
    for (let pageOffset = 1; pageOffset <= pageCount; pageOffset++) {
      const pageToRequest = currentPage + pageOffset;
      this._commitsPaginationPage = pageToRequest;
      pageRequests.push(
        memoryCachedApiRequest(`https://api.github.com/repos/${repositoryOwner}/${repositoryName}/commits?per_page=30&page=${pageToRequest}&sha=${startCommitId ?? ''}`)
      );
    }
    const commitsDataPages = await Promise.all(pageRequests);
    for (const { data: commitsData, headers } of commitsDataPages) {
      this._commitsPaginationIsLast ||= parseLinkHeader(headers.link).next === undefined;
      for (const commitData of commitsData) {
        commits.push(commitFromCommitData(commitData));
      }
    }
    return commits;
  }

  async getCommitsFromActivities() {
    const {
      repositoryOwner,
      repositoryName,
      options,
      _refs: refs,
      _commits: commits,
      _activitiesPaginationCursor: paginationCursor,
    } = this;
    /** @type {Commit[]} */
    const additionalCommits = [];
    const commitsLength = commits.length;
    const alreadyFetchedCommitIds = commits.map(commit => commit.id);
    const refsCommitIds = Object.values(refs).map(ref => ref.commitId);
    const { data: activitiesData, headers } = await memoryCachedApiRequest(`https://api.github.com/repos/${repositoryOwner}/${repositoryName}/activity?per_page=30&after=${paginationCursor ?? ''}`);
    const nextUrl = parseLinkHeader(headers.link).next ?? null;
    const nextCursor = nextUrl ? new URL(nextUrl).searchParams.get('after') : null;
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
      const { data: activityCommitsData } = await storageCachedApiRequest(`https://api.github.com/repos/${repositoryOwner}/${repositoryName}/commits?sha=${commitId}&per_page=30`);
      for (const commitData of activityCommitsData) {
        if (alreadyFetchedCommitIds.includes(commitData.sha)) {
          continue;
        }
        const commit = commitFromCommitData(commitData);
        additionalCommits.push(commit);
        alreadyFetchedCommitIds.push(commit.id);
      }
      if (commitsLength + additionalCommits.length >= options.commitPageSize) {
        break;
      }
    }
    return { additionalCommits, nextCursor };
  }

  async getTags() {
    const { repositoryOwner, repositoryName } = this;
    /** @type {Object.<string, Reference>} A mapping of refs with `fullRefPath` as the keys */
    const refs = {};
    const { data: tagsData } = await memoryCachedApiRequest(`https://api.github.com/repos/${repositoryOwner}/${repositoryName}/tags?per_page=30`);
    for (const tagData of tagsData) {
      const fullRefPath = `refs/tags/${tagData.name}`;
      const commitId = tagData.commit.sha;
      const refType = 'tags';
      const refName = tagData.name;
      refs[fullRefPath] = new Reference({ fullRefPath, commitId, refType, refName });
    }
    return refs;
  }

  async getBranches() {
    const { repositoryOwner, repositoryName } = this;
    /** @type {Object.<string, Reference>} A mapping of refs with `fullRefPath` as the keys */
    const refs = {};
    const { data: refsData } = await memoryCachedApiRequest(`https://api.github.com/repos/${repositoryOwner}/${repositoryName}/git/matching-refs/heads`);
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

  async getRefs() {
    const [tags, branches] = await Promise.all([this.getTags(), this.getBranches()]);
    const refs = { ...tags, ...branches };
    return refs;
  }
}
