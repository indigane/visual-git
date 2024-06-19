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
  const refs = await getRefs(args);
  const commits = await getCommits(args);

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

export async function getRefs({ repositoryOwner, repositoryName }) {
  // Get tags first, because the refs endpoint only returns
  // tag object IDs for tags not the matching commit object IDs.
  const tagsData = await apiRequest(`https://api.github.com/repos/${repositoryOwner}/${repositoryName}/tags?per_page=100`);
  const commitIdByTagName = {};
  for (const tagData of tagsData) {
    commitIdByTagName[tagsData.name] = tagData.commit.sha;
  }
  // All refs
  const refsData = await apiRequest(`https://api.github.com/repos/${repositoryOwner}/${repositoryName}/git/matching-refs/`);
  const refs = {};
  for (const refData of refsData) {
    let commitId;
    if (refData.object.type === 'commit') {
      commitId = refData.object.sha;
    }
    else if (refData.object.type === 'tag') {
      const tagName = refData.ref.split('refs/tags/').pop();
      commitId = tagsData[tagName];
      if (commitId === undefined) {
        // TODO: Fetch tag if not already fetched?
        continue;
      }
    }
    else {
      // Something more exotic is going on, wish I could see that repository.
      // Have to skip for now.
      continue;
    }
    const fullRefPath = refData.ref;
    const { refType, refName } = parseFullRefPath(fullRefPath);
    refs[fullRefPath] = new Reference({ fullRefPath, commitId, refType, refName });
  }
  return refs;
}
