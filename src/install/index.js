const core = require('@actions/core');
const cache = require('@actions/cache');
const process = require('process');

const { VS_ALIASES, VS_VERSIONS } = require('../vs_versions');
const { lsb_version } = require('../utils');

async function tryRestoreCache(version) {
    const useCache = core.getInput('cache') !== 'false';
    if (!useCache) {
        core.info('Cache disabled by user input');
        return false;
    }

    const vs_branch = version.vs_branch;
    const zimg_branch = version.zimg_branch;
    const ubuntu_version = await lsb_version();

    const cacheKeys = [
        `vapoursynth-${vs_branch}-zimg-${zimg_branch}-ubuntu-${ubuntu_version}`,
        `vapoursynth-${vs_branch}-zimg-${zimg_branch}-ubuntu`,
        `vapoursynth-${vs_branch}-zimg-${zimg_branch}`,
    ];

    core.info(`Attempting to restore cache with keys: ${cacheKeys.join(', ')}`);

    const cacheKey = await cache.restoreCache(['/usr/local', '/usr/lib', '/usr/include'], cacheKeys[0], cacheKeys);

    if (cacheKey) {
        core.info(`Cache restored from key: ${cacheKey}`);
        return true;
    } else {
        core.info('No cache found, will build from source');
        return false;
    }
}

async function saveCache(version) {
    const useCache = core.getInput('cache') !== 'false';
    if (!useCache) {
        return;
    }

    const vs_branch = version.vs_branch;
    const zimg_branch = version.zimg_branch;
    const ubuntu_version = await lsb_version();

    const cacheKey = `vapoursynth-${vs_branch}-zimg-${zimg_branch}-ubuntu-${ubuntu_version}`;

    core.info(`Saving cache with key: ${cacheKey}`);
    await cache.saveCache(['/usr/local', '/usr/lib', '/usr/include'], cacheKey);
}

(async()=>{
    const input = core.getInput('version') || 'latest';

    if (!VS_VERSIONS[input] && !VS_ALIASES[input]) {
        throw "Unknown version " + input;
    }

    let version = VS_VERSIONS[input];
    if (!version)
        version = VS_VERSIONS[VS_ALIASES[input]];

    core.setOutput('version', version.minor);

    // Try to restore from cache first
    const cacheHit = await tryRestoreCache(version);

    if (!cacheHit) {
        // Build from source if cache miss
        if (process.platform == 'win32') {
            await require('../build/windows').run(version);
        } else {
            await require('../build/linux').run(version);
        }

        // Save to cache after successful build
        await saveCache(version);
    }

    core.info('VapourSynth installation completed successfully');
})().catch((e) => {console.error(e); core.setFailed("installation failed unexpectedly.");});