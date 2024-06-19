import { parseFullRefPath } from '../git-interface/parsers.js';
import Commit from '../models/commit.js';
import Reference from '../models/reference.js';
import { splitOnce } from '../utils.js';

async function apiRequest(url) {
  const response = await fetch(url);
  return await response.json();
}

/**
 * @param {object} args
 * @param {string} args.repositoryOwner
 * @param {string} args.repositoryName
 */
export async function getCommitsAndRefs(args) {
  const [refs, commits] = await Promise.all([getRefs(args), getCommits(args)]);
  return { commits, refs };
}

export async function getCommits({ repositoryOwner, repositoryName }) {
  const defaultBranchCommitsData = await apiRequest(`https://api.github.com/repos/${repositoryOwner}/${repositoryName}/commits?per_page=100`);
  const commits = [];
  for (const commitData of defaultBranchCommitsData) {
    const [subject, messageBody] = splitOnce(commitData.commit.message, '\n\n');
    commits.push(
      new Commit({
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
      })
    );
  }
  return commits;
}

export async function getTags({ repositoryOwner, repositoryName }) {
  const refs = {};
  const tagsData = await apiRequest(`https://api.github.com/repos/${repositoryOwner}/${repositoryName}/tags?per_page=100`);
  for (const tagData of tagsData) {
    const fullRefPath = `refs/tags/${tagData.name}`;
    const commitId = tagData.commit.sha;
    const refType = 'tags';
    const refName = tagData.name;
    refs[fullRefPath] = new Reference({ fullRefPath, commitId, refType, refName });
  }
  return refs;
}

export async function getBranches({ repositoryOwner, repositoryName }) {
  const refs = {};
  const refsData = await apiRequest(`https://api.github.com/repos/${repositoryOwner}/${repositoryName}/git/matching-refs/heads`);
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

export async function getRefs(args) {
  const [tags, branches] = await Promise.all([getTags(args), getBranches(args)]);
  const refs = { ...tags, ...branches };
  return refs;
}
