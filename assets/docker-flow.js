(() => {
  const root = document.getElementById('live-architecture');
  if (!root) return;
  const scroll = root.querySelector('.df-scroll');
  const stage = root.querySelector('.df-stage');
  const size = root.querySelector('.df-size');
  const cached = root.querySelector('[data-cached]');
  const speed = root.querySelector('[data-speed]');
  const buttons = [...root.querySelectorAll('[data-workflow]')];
  const play = root.querySelector('[data-control="play"]');
  const previous = root.querySelector('[data-control="previous"]');
  const next = root.querySelector('[data-control="next"]');
  const packet = root.querySelector('.df-packet');
  const wires = [...root.querySelectorAll('[data-edge]')];
  const nodes = [...root.querySelectorAll('[data-component]')];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const steps = {
    request: { edge: 'request', nodes: ['cli', 'api'], title: 'Send the command', text: 'The Docker CLI sends a request to the selected host through the Engine API.' },
    api: { edge: 'api', nodes: ['api', 'daemon'], title: 'The daemon receives the request', text: 'dockerd coordinates the operation on this Docker host.' },
    lookup: { edge: 'lookup', nodes: ['daemon', 'images'], title: 'Check the local image store', text: 'With the default pull policy, Docker checks for nginx:alpine locally before contacting the registry.' },
    fetch: { edge: 'pull', nodes: ['registry', 'images'], title: 'Fetch the missing image', text: 'The registry supplies the image manifest and any layers this host still needs. A cached image lets this run skip the registry.' },
    network: { edge: 'network', nodes: ['daemon', 'network'], title: 'Prepare the container', text: 'Docker prepares a writable layer, configures networking and the published port, and applies any requested mounts. This command uses no named volume.' },
    runtime: { edge: 'runtime', nodes: ['daemon', 'containerd'], title: 'Hand the launch to containerd', text: 'The daemon asks containerd to manage the container task and its lifecycle.' },
    shim: { edge: 'shim', nodes: ['containerd', 'runtime'], title: 'Launch through the runtime', text: 'containerd uses a shim and an OCI runtime such as runc. The shim continues supervising the container process after runc exits.' },
    kernel: { edge: 'kernel', nodes: ['runtime', 'kernel'], title: 'Apply isolation and resource settings', text: 'The runtime uses Linux kernel mechanisms, including namespaces and cgroups, to set up the container environment.' },
    start: { edge: 'start', nodes: ['runtime', 'container'], title: 'Nginx is running', text: 'The container process starts. With -d, the CLI returns a container ID. Open 127.0.0.1:8080 to reach Nginx on its published port.' },
    build: { edge: 'build', nodes: ['buildx', 'builder'], title: 'Send a build to BuildKit', text: 'docker build uses Buildx to submit the Dockerfile and build options to BuildKit, which requests the needed source files.' },
    output: { edge: 'output', nodes: ['builder', 'images'], title: 'Produce a local image', text: 'BuildKit executes the Dockerfile, reuses available cache, and exports class-site:1 to the local image store with the default Docker builder.' },
    push: { edge: 'push', nodes: ['images', 'registry'], title: 'Publish the tagged image', text: 'After tagging and authenticating, Docker uploads missing layers and the image manifest to a repository you can publish to. exampleteam is an example account name.' },
    pull: { edge: 'pull', nodes: ['registry', 'images'], title: 'Download the image', text: 'An explicit docker pull contacts the registry to resolve the tag and downloads any layers missing on this host. It makes the image available for later containers.' }
  };
  const workflows = {
    run: { command: 'docker run -d --name class-web -p 127.0.0.1:8080:80 nginx:alpine', steps: ['request', 'api', 'lookup', 'fetch', 'network', 'runtime', 'shim', 'kernel', 'start'] },
    build: { command: 'docker build -t class-site:1 .', steps: ['build', 'output'] },
    push: { command: 'docker tag class-site:1 exampleteam/class-site:1\ndocker push exampleteam/class-site:1', steps: ['request', 'api', 'push'] },
    pull: { command: 'docker pull nginx:alpine', steps: ['request', 'api', 'pull'] }
  };
  let workflow = 'run';
  let sequence = workflows.run.steps;
  let index = 0;
  let elapsed = 0;
  let duration = Number(speed.value);
  let playing = false;
  let frame = null;
  let lastTime = null;
  let interacted = false;
  let activePath;
  let pathLength;

  function positionPacket() {
    const point = activePath.getPointAtLength(pathLength * Math.min(elapsed / duration, 1));
    packet.setAttribute('cx', point.x);
    packet.setAttribute('cy', point.y);
  }

  function render() {
    const step = steps[sequence[index]];
    for (const wire of wires) wire.classList.toggle('is-active', wire.dataset.edge === step.edge);
    for (const node of nodes) node.classList.toggle('is-active', step.nodes.includes(node.dataset.component));
    activePath = wires.find(wire => wire.dataset.edge === step.edge);
    pathLength = activePath.getTotalLength();
    root.querySelector('.df-progress').textContent = 'Step ' + (index + 1) + ' of ' + sequence.length;
    root.querySelector('.df-step-title').textContent = step.title;
    root.querySelector('.df-step-copy').textContent = step.text;
    previous.disabled = index === 0;
    next.disabled = index === sequence.length - 1;
    play.textContent = playing ? 'Pause workflow' : index === sequence.length - 1 ? 'Replay workflow' : 'Play workflow';
    play.setAttribute('aria-label', play.textContent);
    positionPacket();
  }

  function pause() {
    playing = false;
    cancelAnimationFrame(frame);
    frame = null;
    lastTime = null;
    render();
  }

  function tick(time) {
    if (lastTime !== null) elapsed += time - lastTime;
    lastTime = time;
    if (elapsed >= duration) {
      if (index === sequence.length - 1) {
        elapsed = duration;
        pause();
        return;
      }
      index += 1;
      elapsed = 0;
      render();
    }
    positionPacket();
    frame = requestAnimationFrame(tick);
  }

  function start() {
    if (playing) return;
    if (index === sequence.length - 1) {
      index = 0;
      elapsed = 0;
    }
    playing = true;
    lastTime = null;
    render();
    frame = requestAnimationFrame(tick);
  }

  function reset() {
    pause();
    sequence = workflows[workflow].steps.filter(key => !(workflow === 'run' && cached.checked && key === 'fetch'));
    index = 0;
    elapsed = 0;
    root.querySelector('.df-command').textContent = workflows[workflow].command;
    root.querySelector('.df-cache').hidden = workflow !== 'run';
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.workflow === workflow));
    render();
  }

  function move(delta) {
    interacted = true;
    pause();
    index = Math.max(0, Math.min(sequence.length - 1, index + delta));
    elapsed = 0;
    render();
  }

  for (const button of buttons) button.addEventListener('click', () => {
    interacted = true;
    workflow = button.dataset.workflow;
    reset();
    if (!motion.matches) start();
  });
  cached.addEventListener('change', () => {
    interacted = true;
    const resume = playing;
    reset();
    if (resume) start();
  });
  speed.addEventListener('change', () => {
    const fraction = elapsed / duration;
    duration = Number(speed.value);
    elapsed = fraction * duration;
  });
  play.addEventListener('click', () => {
    interacted = true;
    if (playing) pause();
    else start();
  });
  previous.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  root.querySelector('[data-control="reset"]').addEventListener('click', () => {
    interacted = true;
    reset();
  });

  new ResizeObserver(() => {
    const width = Math.max(760, scroll.clientWidth);
    const scale = width / 1040;
    stage.style.transform = 'scale(' + scale + ')';
    size.style.width = width + 'px';
    size.style.height = 650 * scale + 'px';
  }).observe(scroll);
  new IntersectionObserver(entries => {
    const visible = entries[0].isIntersecting;
    if (visible && !interacted && !motion.matches) {
      interacted = true;
      start();
    } else if (!visible && playing) {
      pause();
    }
  }, { threshold: 0.15 }).observe(root);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
  });
  function updateMotion() {
    root.querySelector('.df-motion-note').hidden = !motion.matches;
    if (motion.matches) pause();
  }
  motion.addEventListener('change', updateMotion);
  render();
  updateMotion();
})();

