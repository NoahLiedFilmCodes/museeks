import store from '../store.js';
import AppConstants  from '../constants/AppConstants';

import ToastsActions from './ToastsActions';

import app from '../lib/app';
import Player from '../lib/player';
import utils from '../utils/utils';

const ipcRenderer    = electron.ipcRenderer;

const audioErrors = {
  aborted:  'The video playback was aborted.',
  corrupt:  'The audio playback was aborted due to a corruption problem.',
  notFound: 'The track file could not be found. It may be due to a file move or an unmounted partition.',
  unknown:  'An unknown error occurred.',
};


const playToggle = () => {
  const { paused } = Player.getAudio();
  // TODO (y.solovyov | KeitIG): calling getState is a hack.
  const { queue, playerStatus } = store.getState();

  if(playerStatus === 'stop') {
    start();
  } else if (paused && queue.length > 0) {
    play();
  } else {
    pause();
  }
};

const play = () => {
  // TODO (y.solovyov | KeitIG): calling getState is a hack.
  const { queue } = store.getState();
  if(queue !== null) {
    Player.play();
    store.dispatch({
      type : AppConstants.APP_PLAYER_PLAY,
    });
  }
};

const pause = () => {
  // TODO (y.solovyov | KeitIG): calling getState is a hack.
  const { queue } = store.getState();
  if(queue !== null) {
    Player.pause();
    store.dispatch({
      type : AppConstants.APP_PLAYER_PAUSE,
    });
  }
};

const start = (_id) => {
  // TODO (y.solovyov | KeitIG): calling getState is a hack.
  const { tracks, tracksCursor } = store.getState();
  const queue = [...tracks[tracksCursor].sub];

  if(queue.length === 0) return;

  const trackId = _id || queue[0]._id;

  const queuePosition = queue.findIndex((track) => {
    return track._id === trackId;
  });

  if (queuePosition > -1) {
    const uri = utils.parseUri(queue[queuePosition].path);

    Player.setAudioSrc(uri);
    Player.play();

    store.dispatch({
      type : AppConstants.APP_PLAYER_START,
      queuePosition,
      _id,
    });
  }
};

const stop = () => {
  Player.stop();
  store.dispatch({
    type : AppConstants.APP_PLAYER_STOP,
  });

  ipcRenderer.send('playerAction', 'stop');
};

const next = () => {
  // TODO (y.solovyov | KeitIG): calling getState is a hack.
  const { queue, queueCursor, repeat } = store.getState();
  let newQueueCursor;

  if(repeat === 'one') {
    newQueueCursor = queueCursor;
  } else if (repeat === 'all' && queueCursor === queue.length - 1) { // is last track
    newQueueCursor = 0; // start with new track
  } else {
    newQueueCursor = queueCursor + 1;
  }

  const track = queue[newQueueCursor];

  if (track !== undefined) {
    const uri = utils.parseUri(track.path);

    Player.setAudioSrc(uri);
    Player.play();
    store.dispatch({
      type : AppConstants.APP_PLAYER_NEXT,
      newQueueCursor,
    });
  } else {
    stop();
  }
};

const previous = () => {
  const currentTime = Player.getCurrentTime();

  // TODO (y.solovyov | KeitIG): calling getState is a hack.
  const { queue, queueCursor } = store.getState();
  let newQueueCursor = queueCursor;

  // If track started less than 5 seconds ago, play th previous track,
  // otherwise replay the current one
  if (currentTime < 5) {
    newQueueCursor = queueCursor - 1;
  }

  const newTrack = queue[newQueueCursor];

  if (newTrack !== undefined) {
    const uri = utils.parseUri(newTrack.path);

    Player.setAudioSrc(uri);
    Player.play();

    store.dispatch({
      type : AppConstants.APP_PLAYER_PREVIOUS,
      currentTime,
      newQueueCursor,
    });
  } else {
    stop();
  }
};

const shuffle = (shuffle) => {
  app.config.set('audioShuffle', shuffle);
  app.config.saveSync();

  const currentSrc = Player.getSrc();
  store.dispatch({
    type : AppConstants.APP_PLAYER_SHUFFLE,
    shuffle,
    currentSrc,
  });
};

const repeat = (repeat) => {
  app.config.set('audioRepeat', repeat);
  app.config.saveSync();

  store.dispatch({
    type : AppConstants.APP_PLAYER_REPEAT,
    repeat,
  });
};

const setVolume = (volume) => {
  if(!isNaN(parseFloat(volume)) && isFinite(volume)) {
    Player.setAudioVolume(volume);

    app.config.set('audioVolume', volume);
    app.config.saveSync();
    store.dispatch({
      type : AppConstants.APP_REFRESH_CONFIG,
    });
  }
};

const setMuted = (muted = false) => {
  if(muted) Player.mute();
  else Player.unmute();

  app.config.set('audioMuted', muted);
  app.config.saveSync();
  store.dispatch({
    type : AppConstants.APP_REFRESH_CONFIG,
  });
};

const setPlaybackRate = (value) => {
  if(!isNaN(parseFloat(value)) && isFinite(value)) { // if is numeric
    if(value >= 0.5 && value <= 5) { // if in allowed range
      Player.setAudioPlaybackRate(value);

      app.config.set('audioPlaybackRate', parseFloat(value));
      app.config.saveSync();
      store.dispatch({
        type : AppConstants.APP_REFRESH_CONFIG,
      });
    }
  }
};

const jumpTo = (to) => {
  // TODO (y.solovyov) do we want to set some explicit state?
  // if yes, what should it be? if not, do we need this actions at all?
  Player.setAudioCurrentTime(to);
  store.dispatch({
    type : AppConstants.APP_PLAYER_JUMP_TO,
  });
};

const audioError = (e) => {
  stop();
  switch (e.target.error.code) {
    case e.target.error.MEDIA_ERR_ABORTED:
      ToastsActions.add('warning', audioErrors.aborted);
      break;
    case e.target.error.MEDIA_ERR_DECODE:
      ToastsActions.add('danger', audioErrors.corrupt);
      break;
    case e.target.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
      ToastsActions.add('danger', audioErrors.notFound);
      break;
    default:
      ToastsActions.add('danger', audioErrors.unknown);
      break;
  }
};


export default {
  audioError,
  jumpTo,
  next,
  pause,
  play,
  playToggle,
  previous,
  repeat,
  setMuted,
  setPlaybackRate,
  setVolume,
  shuffle,
  start,
  stop,
  audioErrors,
};
