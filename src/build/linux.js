const io = require('@actions/io');
const core = require('@actions/core');
const { exec } = require('@actions/exec');

const { lsb_version } = require('../utils');

function get_container_from_id(id, suffix="-git/") {
    return "/tmp/" + id + suffix;
}

async function downloadAndCompile(link, id, branch, configures=[], cbs={}) {
    const container = get_container_from_id(id);

    if (!!cbs.pre) {
        await cbs.pre(container);
    }
    
    core.info("Cloning " + id);
    await exec('git', ['clone', link, '--depth', '1', '--branch', branch, container]);

    core.info("Compiling " + id);
    await exec('./autogen.sh', [], {cwd: container});
    await exec('./configure', `--prefix=/home/runner/${configures}/`, {cwd: container});
    await exec("make", [], {cwd: container});
    await exec("sudo", ["make", "install"], {cwd: container});

    if (!!cbs.post) {
        await cbs.post(container);
    }
}

async function build(link, id, branch, configures="", cbs={}) {
    core.startGroup("Installing Building Tool for: " + id+"@"+branch);
   try {
        await downloadAndCompile(link, id, branch, configures, cbs);
    } finally {
        core.endGroup();
    }
}


export async function run(config) {
    const vs_branch = config.vs_branch;
    const zimg_branch = config.zimg_branch;

    await build("https://github.com/sekrit-twc/zimg", "zimg", zimg_branch, "zimg", false);

    // Set environment for VapourSynth to find zimg
    process.env.PKG_CONFIG_PATH = `/home/runner/zimg/lib/pkgconfig:${process.env.PKG_CONFIG_PATH || ''}`;
    process.env.LD_LIBRARY_PATH = `/home/runner/zimg/lib:${process.env.LD_LIBRARY_PATH || ''}`;

    await build("https://github.com/vapoursynth/vapoursynth", "vs", vs_branch, "vapoursynth", {
        pre: async()=>{
            core.info("Ensuring existence of nasm...");
            await exec("sudo", ["apt-get", "install", "--yes", "nasm"]);
            await exec("pip", ["install", "cython", "wheel"]);
        },
        post: async(path)=>{
            const buildEnv = {
                ...process.env,
                PKG_CONFIG_PATH: `/home/runner/vapoursynth/lib/pkgconfig:/home/runner/zimg/lib/pkgconfig:${process.env.PKG_CONFIG_PATH || ''}`,
                LD_LIBRARY_PATH: `/home/runner/vapoursynth/lib:/home/runner/zimg/lib:${process.env.LD_LIBRARY_PATH || ''}`,
                LIBRARY_PATH: `/home/runner/vapoursynth/lib:/home/runner/zimg/lib:${process.env.LIBRARY_PATH || ''}`
            };

            core.info("Building python package.");
            await exec("python", ["setup.py", "bdist_wheel"], {cwd: path, env: buildEnv});
            await exec("pip", ["install", "."], {cwd: path, env: buildEnv});

            // Copy wheel to cache directory
            core.info("Copying wheel to cache directory.");
            await exec("mkdir", ["-p", "/home/runner/vs-wheel"]);
            await exec("cp", [`${path}/dist/*.whl`, "/home/runner/vs-wheel/"], {shell: true});
        }
    });
}