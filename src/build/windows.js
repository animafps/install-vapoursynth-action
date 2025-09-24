const { exec } = require('@actions/exec');
const core = require('@actions/core');
const path = require('path');

export async function run(config) {
    const { readdir } = require('fs').promises;
    const vsVersion = config.vs_branch;
    const downloadUrl = `https://github.com/vapoursynth/vapoursynth/releases/download/${vsVersion}/VapourSynth64-Portable-${vsVersion}.zip`;
    const downloadPath = path.join(process.env.RUNNER_TEMP || '/tmp', `vapoursynth-${vsVersion}.zip`);
    const extractPath = path.join(process.env.RUNNER_TEMP || '/tmp', `vapoursynth-${vsVersion}`);

    core.info(`Downloading VapourSynth from ${downloadUrl}`);

    // Download the portable zip file
    await exec('curl', ['-L', '-o', downloadPath, downloadUrl]);

    // Extract the zip file
    core.info(`Extracting VapourSynth to ${extractPath}`);
    await exec('powershell', ['-Command', `Expand-Archive -Path '${downloadPath}' -DestinationPath '${extractPath}' -Force`]);
    
    const wheelFiles = await readdir(`${extractPath}\\VapourSynth64-Portable\\wheel`);
    const wheelFile = wheelFiles.find(file => file.endsWith('.whl'));
            
    await exec('cmd', ['pip install', `${extractPath}\\VapourSynth64-Portable\\wheel\\${wheelFile}`]);
    // Add VapourSynth to PATH
    const vsPath = path.join(extractPath, 'VapourSynth64-Portable');
    core.addPath(vsPath);

    core.info('VapourSynth installation completed');
}