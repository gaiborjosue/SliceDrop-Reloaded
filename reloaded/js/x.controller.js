/*

    .----.                    _..._                                                     .-'''-.
   / .--./    .---.        .-'_..._''.                          _______                '   _    \
  ' '         |   |.--.  .' .'      '.\     __.....__           \  ___ `'.           /   /` '.   \_________   _...._
  \ \         |   ||__| / .'            .-''         '.    ,.--. ' |--.\  \         .   |     \  '\        |.'      '-.
   `.`'--.    |   |.--.. '             /     .-''"'-.  `. //    \| |    \  ' .-,.--.|   '      |  '\        .'```'.    '.
     `'-. `.  |   ||  || |            /     /________\   \\\    /| |     |  '|  .-. \    \     / /  \      |       \     \
         `. \ |   ||  || |            |                  | `'--' | |     |  || |  | |`.   ` ..' /    |     |        |    |
           \ '|   ||  |. '            \    .-------------' ,.--. | |     ' .'| |  | |   '-...-'`     |      \      /    .
            | |   ||  | \ '.          .\    '-.____...---.//    \| |___.' /' | |  '-                 |     |\`'-.-'   .'
            | |   ||__|  '. `._____.-'/ `.             .' \\    /_______.'/  | |                     |     | '-....-'`
           / /'---'        `-.______ /    `''-...... -'    `'--'\_______|/   | |                    .'     '.
     /...-'.'                       `                                        |_|                  '-----------'
    /--...-'

    Slice:Drop - Instantly view scientific and medical imaging data in 3D.

     http://slicedrop.com

    Copyright (c) 2012 The Slice:Drop and X Toolkit Developers <dev@goXTK.com>

    Slice:Drop is licensed under the MIT License:
      http://www.opensource.org/licenses/mit-license.php

    CREDITS: http://slicedrop.com/LICENSE

*/

var selectedVolumeIndex = 0;
var selectedMeshIndex = 0;
var selectedMeshLayerIndex = 0;
var selectedFiberIndex = 0;
var selectedFiberId = null;
var suppressMeshLayerColorUpdate = false;

/**
 * Setup all UI elements once the loading was completed.
 */
function setupUi() {

  // LOAD POWERBOOST
  var script = document.createElement("script");
  script.type = "text/javascript";
  script.src = "https://mpsych.github.io/powerboost/dist/powerboost.min.js";
  document.head.appendChild(script);

  updatePanelCaptions();

  // VOLUME
  if (nv.volumes.length > 0) {

    populateVolumeControls();
    refreshVolumeControls();

    // // update window/level slider
    // jQuery('#windowlevel-volume').dragslider("option", "max", volume.max);
    // jQuery('#windowlevel-volume').dragslider("option", "min", volume.min);
    // jQuery('#windowlevel-volume').dragslider("option", "values",
    //     [volume.min, volume.max/2]);

    // volume.windowHigh = volume.max/2;



    // volume.opacity = 0.2; // re-propagate
    // volume.modified();

    // update 2d slice sliders
    var dim = getSelectedVolume().range;

    // // ax
    // jQuery("#blue_slider").slider("option", "disabled", false);
    // jQuery("#blue_slider").slider("option", "min", 0);
    // jQuery("#blue_slider").slider("option", "max", dim[2] - 1);
    // jQuery("#blue_slider").slider("option", "value", volume.indexZ);

    // // sag
    // jQuery("#red_slider").slider("option", "disabled", false);
    // jQuery("#red_slider").slider("option", "min", 0);
    // jQuery("#red_slider").slider("option", "max", dim[0] - 1);
    // jQuery("#red_slider").slider("option", "value", volume.indexX);

    // // cor
    // jQuery("#green_slider").slider("option", "disabled", false);
    // jQuery("#green_slider").slider("option", "min", 0);
    // jQuery("#green_slider").slider("option", "max", dim[1] - 1);
    // jQuery("#green_slider").slider("option", "value", volume.indexY);


    // ENABLE THAT TAB
    jQuery('#volume .menu').removeClass('menuDisabled');
    pinSidebarPanel('volume');

  } else {

    // no volume
    jQuery('#volume .menu').addClass('menuDisabled');
    // jQuery("#blue_slider").slider("option", "disabled", true);
    // jQuery("#red_slider").slider("option", "disabled", true);
    // jQuery("#green_slider").slider("option", "disabled", true);

  }

  // LABELMAP
  // if (_data.labelmap.file.length > 0) {
  if (-1 > 0) {

    jQuery('#labelmapSwitch').show();

    jQuery('#opacity-labelmap').slider("option", "value", 40);
    volume.labelmap.opacity = 0.4; // re-propagate


  } else {

    // no labelmap
    jQuery('#labelmapSwitch').hide();

  }


  // MESH
  if (getConfigurableMeshes().length > 0) {
    populateMeshControls();
    refreshMeshControls();
    jQuery('#mesh .menu').removeClass('menuDisabled');
    pinSidebarPanel('mesh');
  } else {
    jQuery('#mesh .menu').addClass('menuDisabled');
  }

  if (getConfigurableFibers().length > 0) {
    populateFiberControls();
    refreshFiberControls();
    jQuery('#fibers .menu').removeClass('menuDisabled');
    pinSidebarPanel('fibers');
  } else {
    jQuery('#fibers .menu').addClass('menuDisabled');
  }


  // initialize_sharing();


}

function updatePanelCaptions() {

  jQuery('#volumePanelCaption').text(nv.volumes.length > 1 ? 'VOLUMES' : 'VOLUME');
  jQuery('#meshPanelCaption').text(getConfigurableMeshes().length > 1 ? 'MESHES' : 'MESH');

}

function pinSidebarPanel(panelId) {

  var item = jQuery('#' + panelId);
  var menu = item.find('.menu');
  var pin = item.find('.pinicon');

  menu.stop().css('marginLeft', '-2px');
  pin.removeClass('ui-icon-pin-w').addClass('ui-icon-pin-s');

}

function getSelectedVolume() {

  if (!nv || !nv.volumes || nv.volumes.length === 0) {
    return null;
  }

  selectedVolumeIndex = Math.min(
    Math.max(selectedVolumeIndex, 0),
    nv.volumes.length - 1
  );

  return nv.volumes[selectedVolumeIndex];

}

function populateVolumeControls() {

  var labelmapSwitch = jQuery('#labelmapSwitch');

  selectedVolumeIndex = Math.min(selectedVolumeIndex, nv.volumes.length - 1);
  jQuery('#volumetabs > .volumetabs').remove();

  for (var i = 0; i < nv.volumes.length; i++) {
    var tab = jQuery('<a>', {
      class: 'volumetabs' + (i === selectedVolumeIndex ? ' selected' : ''),
      href: '#volumeTab',
      text: 'Volume ' + (i + 1)
    });

    tab.attr('data-volume-index', i);
    tab.css('left', (i * 64) + 'px');
    tab.insertBefore(labelmapSwitch);
  }

  bindVolumeTabs();

  populateColormapSelector();

}

function bindVolumeTabs() {

  jQuery('#volumetabs > .volumetabs').off('click.volumeselect');
  jQuery('#volumetabs > .volumetabs').on('click.volumeselect', function(event) {
    event.preventDefault();
    selectedVolumeIndex = Number(jQuery(this).attr('data-volume-index')) || 0;
    jQuery('#labelmapTab').hide();
    jQuery('#volumeTab').show();
    jQuery('#labelmapSwitch').removeClass('selected');
    refreshVolumeControls();
  });

  jQuery('#labelmapSwitch').off('click.volumeselect');
  jQuery('#labelmapSwitch').on('click.volumeselect', function() {
    jQuery('#volumetabs > .volumetabs').removeClass('selected');
  });

}

function populateColormapSelector() {

  var selector = jQuery('#colormap-volume');
  var colormaps = typeof nv.colormaps === 'function' ? nv.colormaps() : [];

  selector.empty();

  for (var i = 0; i < colormaps.length; i++) {
    var name = typeof colormaps[i] === 'string' ? colormaps[i] : colormaps[i].name;

    if (!name) {
      continue;
    }

  selector.append(jQuery('<option>', {
      value: name,
      text: name
    }));
  }

}

function ensureColormapOption(name) {

  var selector = jQuery('#colormap-volume');

  if (!name || selector.find('option[value="' + name + '"]').length > 0) {
    return;
  }

  selector.append(jQuery('<option>', {
    value: name,
    text: name
  }));

}

function refreshVolumeControls() {

  var volume = getSelectedVolume();

  if (!volume) {
    return;
  }

  console.log('Setting up volume', selectedVolumeIndex);

  jQuery('#volumetabs > .volumetabs').removeClass('selected');
  jQuery('#volumetabs > .volumetabs[data-volume-index="' + selectedVolumeIndex + '"]').addClass('selected');
  ensureColormapOption(volume.colormap);
  jQuery('#colormap-volume').val(volume.colormap || 'gray');

  jQuery('#windowlevel-volume').dragslider("option", "max", volume.global_max);
  jQuery('#windowlevel-volume').dragslider("option", "min", volume.global_min);
  jQuery('#windowlevel-volume').dragslider("option", "values",
      [volume.cal_min, volume.cal_max]);

  jQuery('#opacity-volume').slider("option", "value", Math.round((volume.opacity ?? 1) * 100));

}

function getConfigurableMeshes() {

  if (!nv || !Array.isArray(nv.meshes)) {
    return [];
  }

  return nv.meshes
    .map(function(mesh, index) {
      return { mesh: mesh, index: index };
    })
    .filter(function(entry) {
      return typeof entry.mesh.fiberLengths === 'undefined';
    });

}

function getSelectedMesh() {

  var meshes = getConfigurableMeshes();

  if (meshes.length === 0) {
    return null;
  }

  var selected = meshes.find(function(entry) {
    return entry.index === selectedMeshIndex;
  });

  if (!selected) {
    selected = meshes[0];
    selectedMeshIndex = selected.index;
  }

  return selected.mesh;

}

function getSelectedMeshLayer() {

  var mesh = getSelectedMesh();

  if (!mesh || !Array.isArray(mesh.layers) || mesh.layers.length === 0) {
    return null;
  }

  selectedMeshLayerIndex = Math.min(
    Math.max(selectedMeshLayerIndex, 0),
    mesh.layers.length - 1
  );

  return mesh.layers[selectedMeshLayerIndex];

}

function populateMeshControls() {

  var meshes = getConfigurableMeshes();
  var meshContent = jQuery('#mesh1');

  jQuery('#mesh .meshtabs').remove();

  if (!meshes.some(function(entry) {
    return entry.index === selectedMeshIndex;
  })) {
    selectedMeshIndex = meshes[0].index;
  }

  for (var i = 0; i < meshes.length; i++) {
    var entry = meshes[i];
    var tab = jQuery('<a>', {
      class: 'meshtabs' + (entry.index === selectedMeshIndex ? ' selected' : ''),
      text: 'Mesh ' + (i + 1)
    });

    tab.attr('data-mesh-index', entry.index);
    tab.css('left', (i * 57) + 'px');
    tab.insertBefore(meshContent);
  }

  bindMeshTabs();

}

function refreshMeshControls() {

  var mesh = getSelectedMesh();

  if (!mesh) {
    return;
  }

  jQuery('#mesh .meshtabs').removeClass('selected');
  jQuery('#mesh .meshtabs[data-mesh-index="' + selectedMeshIndex + '"]').addClass('selected');
  jQuery('#opacity-mesh').slider("option", "disabled", false);
  jQuery('#opacity-mesh').slider("option", "value", Math.round((mesh.opacity ?? 1) * 100));

  refreshMeshLayerControls(mesh);

}

function refreshMeshLayerControls(mesh) {

  var selector = jQuery('#scalars-selector');
  var layers = Array.isArray(mesh.layers) ? mesh.layers : [];

  selector.empty();
  refreshMeshColorbarVisibility(layers);

  if (layers.length === 0) {
    selector.append(jQuery('<option>', {
      value: '',
      text: 'No layers'
    }));
    selector.prop('disabled', true);
    jQuery("#threshold-scalars").dragslider("option", "disabled", true);
    setMeshLayerColorControlsEnabled(false);
    return;
  }

  selectedMeshLayerIndex = Math.min(selectedMeshLayerIndex, layers.length - 1);

  for (var i = 0; i < layers.length; i++) {
    var layer = layers[i];
    var label = layer.name || layer.url || ('Layer ' + (i + 1));

    selector.append(jQuery('<option>', {
      value: i,
      text: (i + 1) + '. ' + label
    }));
  }

  selector.prop('disabled', false);
  selector.val(String(selectedMeshLayerIndex));

  var range = getMeshLayerRange(layers[selectedMeshLayerIndex]);
  refreshMeshLayerColorControls(layers[selectedMeshLayerIndex]);
  jQuery("#threshold-scalars").dragslider("option", "disabled", false);
  jQuery("#threshold-scalars").dragslider("option", "min", range.min);
  jQuery("#threshold-scalars").dragslider("option", "max", range.max);
  jQuery("#threshold-scalars").dragslider("option", "values", [range.calMin, range.calMax]);

}

function refreshMeshColorbarVisibility(layers) {

  if (layers.length <= 1) {
    return;
  }

  nv.opts.isColorbar = true;

  for (var i = 0; i < layers.length; i++) {
    layers[i].colorbarVisible = i > 0;
  }

  nv.updateGLVolume();

}

function refreshMeshLayerColorControls(layer) {

  var minColor = layer._sliceDropMinColor || {r: 0, g: 255, b: 0};
  var maxColor = layer._sliceDropMaxColor || {r: 255, g: 0, b: 0};

  suppressMeshLayerColorUpdate = true;
  jQuery('#scalarsMinColor').miniColors('value', colorToHex(minColor));
  jQuery('#scalarsMaxColor').miniColors('value', colorToHex(maxColor));
  suppressMeshLayerColorUpdate = false;
  setMeshLayerColorControlsEnabled(true);

}

function setMeshLayerColorControlsEnabled(enabled) {

  jQuery('#scalarsMinColor').prop('disabled', !enabled);
  jQuery('#scalarsMaxColor').prop('disabled', !enabled);

}

function getMeshLayerRange(layer) {

  var min = Number.isFinite(layer.global_min) ? layer.global_min : layer.cal_min;
  var max = Number.isFinite(layer.global_max) ? layer.global_max : layer.cal_max;

  if (!Number.isFinite(min)) {
    min = 0;
  }

  if (!Number.isFinite(max)) {
    max = 1;
  }

  if (min === max) {
    max = min + 1;
  }

  var calMin = Number.isFinite(layer.cal_min) ? layer.cal_min : min;
  var calMax = Number.isFinite(layer.cal_max) ? layer.cal_max : max;

  return {
    min: min,
    max: max,
    calMin: Math.max(min, Math.min(max, calMin)),
    calMax: Math.max(min, Math.min(max, calMax))
  };

}

function bindMeshTabs() {

  jQuery('#mesh .meshtabs').off('click.meshselect');
  jQuery('#mesh .meshtabs').on('click.meshselect', function() {
    selectedMeshIndex = Number(jQuery(this).attr('data-mesh-index')) || 0;
    selectedMeshLayerIndex = 0;
    refreshMeshControls();
  });

}

function getConfigurableFibers() {

  if (!nv || !Array.isArray(nv.meshes)) {
    return [];
  }

  return nv.meshes
    .map(function(mesh, index) {
      return { mesh: mesh, index: index };
    })
    .filter(function(entry) {
      return typeof entry.mesh.fiberLengths !== 'undefined';
    });

}

function getSelectedFiber() {

  var fibers = getConfigurableFibers();

  if (fibers.length === 0) {
    return null;
  }

  var selected = null;

  if (selectedFiberId !== null) {
    selected = fibers.find(function(entry) {
      return String(entry.mesh.id) === String(selectedFiberId);
    });
  }

  if (!selected) {
    selected = fibers.find(function(entry) {
      return entry.index === selectedFiberIndex;
    });
  }

  if (!selected) {
    selected = fibers[0];
  }

  selectedFiberIndex = selected.index;
  selectedFiberId = selected.mesh.id;

  return selected.mesh;

}

function populateFiberControls() {

  var fibers = getConfigurableFibers();
  var fiberContent = jQuery('#fibers1');

  jQuery('#fibers .fiberstabs').remove();

  if (!fibers.some(function(entry) {
    return String(entry.mesh.id) === String(selectedFiberId);
  })) {
    var selectedByIndex = fibers.find(function(entry) {
      return entry.index === selectedFiberIndex;
    }) || fibers[0];

    selectedFiberIndex = selectedByIndex.index;
    selectedFiberId = selectedByIndex.mesh.id;
  }

  for (var i = 0; i < fibers.length; i++) {
    var entry = fibers[i];
    var tab = jQuery('<a>', {
      class: 'fiberstabs' + (String(entry.mesh.id) === String(selectedFiberId) ? ' selected' : ''),
      text: 'Fibers ' + (i + 1)
    });

    tab.attr('data-fiber-index', entry.index);
    tab.attr('data-fiber-id', entry.mesh.id);
    tab.css('left', (i * 63) + 'px');
    tab.insertBefore(fiberContent);
  }

  bindFiberTabs();

}

function refreshFiberControls() {

  var fiber = getSelectedFiber();

  if (!fiber) {
    return;
  }

  jQuery('#fibers .fiberstabs').removeClass('selected');
  jQuery('#fibers .fiberstabs').filter(function() {
    return String(jQuery(this).attr('data-fiber-id')) === String(selectedFiberId);
  }).addClass('selected');
  jQuery('#threshold-fibers').dragslider("option", "disabled", false);

  var range = getFiberLengthRange(fiber);
  var threshold = Number.isFinite(fiber.fiberLength) ? fiber.fiberLength : range.min;

  if (fiber._sliceDropFiberHidden) {
    threshold = range.max;
  }

  threshold = Math.max(range.min, Math.min(range.max, threshold));

  jQuery("#threshold-fibers").dragslider("option", "min", range.min);
  jQuery("#threshold-fibers").dragslider("option", "max", range.max);
  jQuery("#threshold-fibers").dragslider("option", "values", [threshold, range.max]);
  refreshFiberVisibilityControl(fiber);
  refreshFiberColorationControls(fiber);

}

function getFiberLengthRange(fiber) {

  var lengths = fiber && fiber.fiberLengths && Number.isFinite(fiber.fiberLengths.length)
    ? fiber.fiberLengths
    : [];
  var min = Infinity;
  var max = -Infinity;

  for (var i = 0; i < lengths.length; i++) {
    var length = Number(lengths[i]);

    if (!Number.isFinite(length)) {
      continue;
    }

    min = Math.min(min, length);
    max = Math.max(max, length);
  }

  if (!Number.isFinite(min)) {
    min = 0;
  }

  if (!Number.isFinite(max)) {
    max = 1;
  }

  if (min === max) {
    max = min + 1;
  }

  return {
    min: min,
    max: max
  };

}

function bindFiberTabs() {

  jQuery('#fibers .fiberstabs').off('click.fiberselect');
  jQuery('#fibers .fiberstabs').on('click.fiberselect', function() {
    selectedFiberIndex = Number(jQuery(this).attr('data-fiber-index')) || 0;
    selectedFiberId = jQuery(this).attr('data-fiber-id');
    refreshFiberControls();
  });

}

function refreshFiberVisibilityControl(fiber) {

  jQuery('#fibersvisibility')
    .toggleClass('show-icon', !fiber._sliceDropFiberHidden)
    .toggleClass('hide-icon', Boolean(fiber._sliceDropFiberHidden));

}

function refreshFiberColorationControls(fiber) {

  var selector = jQuery('#fiber-coloration-selector');
  var selectedColoration = fiber.fiberColor || 'Global';
  var options = [
    { value: 'Global', text: 'Global direction' },
    { value: 'Local', text: 'Local direction' },
    { value: 'Fixed', text: 'Fixed' }
  ];

  if (fiber.dpv && fiber.dpv.length > 0) {
    options.push({ value: 'DPV0', text: 'First Per Vertex' });
  }

  if (fiber.dps && fiber.dps.length > 0) {
    options.push({ value: 'DPS0', text: 'First Per Streamline' });
  }

  selector.empty();

  for (var i = 0; i < options.length; i++) {
    selector.append(jQuery('<option>', options[i]));
  }

  if (selectedColoration && selector.find('option[value="' + selectedColoration + '"]').length === 0) {
    selector.append(jQuery('<option>', {
      value: selectedColoration,
      text: selectedColoration
    }));
  }

  selector.val(selectedColoration);

}

function scalarsSelectorChanged() {

  selectedMeshLayerIndex = Number(jQuery('#scalars-selector').val()) || 0;
  refreshMeshControls();

}

function colormapVolumeChanged() {

  var volume = getSelectedVolume();
  var colormap = jQuery('#colormap-volume').val();

  if (!volume || !colormap) {
    return;
  }

  nv.setColormap(volume.id, colormap);
  volume.fgcolor = {r:1,g:1,b:1};
  volume.bgcolor = {r:0,g:0,b:0};
  nv.updateGLVolume();

}

function volumerenderingOnOff(bool) {

  if (bool) {

    nv.setVolumeRenderIllumination(0);

  } else {

    nv.setVolumeRenderIllumination(-1);

  }

  // if (!volume) {
  //   return;
  // }

  // if (bool) {
  //   volume.lowerThreshold = (volume.min + (volume.max/10));
  // }

  // volume.volumeRendering = bool;

  // if (RT.linked) {

  //   clearTimeout(RT._updater);
  //   RT._updater = setTimeout(RT.pushVolume.bind(RT, 'volumeRendering', volume.volumeRendering), 150);
  // }


}

function windowLevelVolume(event, ui) {

  var volume = getSelectedVolume();

  if (!volume) {
    return;
  }

  volume.cal_min = ui.values[0];
  volume.cal_max = ui.values[1];
  nv.updateGLVolume();

  // if (!volume) {
  //   return;
  // }

  // volume.lowerThreshold = ui.values[0];
  // volume.upperThreshold = ui.values[1];

  // if (RT.linked) {

  //   clearTimeout(RT._updater);
  //   RT._updater = setTimeout(RT.pushVolume.bind(RT, 'lowerThreshold', volume.lowerThreshold), 150);
  //   clearTimeout(RT._updater2);
  //   RT._updater2 = setTimeout(RT.pushVolume.bind(RT, 'upperThreshold', volume.upperThreshold), 150);

  // }


}

// function windowLevelVolume(event, ui) {

//   nv.setGamma(ui.value);

//   // if (!volume) {
//   //   return;
//   // }

//   // volume.windowLow = ui.values[0];
//   // volume.windowHigh = ui.values[1];

//   // if (RT.linked) {

//   //   clearTimeout(RT._updater);
//   //   RT._updater = setTimeout(RT.pushVolume.bind(RT, 'windowLow', volume.windowLow), 150);
//   //   clearTimeout(RT._updater2);
//   //   RT._updater2 = setTimeout(RT.pushVolume.bind(RT, 'windowHigh', volume.windowHigh), 150);

//   // }


// }

function opacity3dVolume(event, ui) {

  // if (!volume) {
  //   return;
  // }

  if (!getSelectedVolume()) {
    return;
  }

  nv.setOpacity(selectedVolumeIndex, ui.value / 100);

  // volume.opacity = ui.value / 100;

  // if (RT.linked) {

  //   clearTimeout(RT._updater);
  //   RT._updater = setTimeout(RT.pushVolume.bind(RT, 'opacity', volume.opacity), 150);

  // }


}

// function volumeslicingSag(event, ui) {

//   if (!volume) {
//     return;
//   }

//   volume.indexX = Math
//       .floor(jQuery('#red_slider').slider("option", "value"));

//   if (RT.linked) {

//     clearTimeout(RT._updater);
//     RT._updater = setTimeout(RT.pushVolume.bind(RT, 'indexY', volume.indexX), 150);

//   }

// }

// function volumeslicingAx(event, ui) {

//   if (!volume) {
//     return;
//   }

//   volume.indexZ = Math.floor(jQuery('#blue_slider').slider("option", "value"));

//   if (RT.linked) {

//     clearTimeout(RT._updater);
//     RT._updater = setTimeout(RT.pushVolume.bind(RT, 'indexX', volume.indexZ), 150);

//   }

// }

// function volumeslicingCor(event, ui) {

//   if (!volume) {
//     return;
//   }

//   volume.indexY = Math.floor(jQuery('#green_slider').slider("option", "value"));

//   if (RT.linked) {

//     clearTimeout(RT._updater);
//     RT._updater = setTimeout(RT.pushVolume.bind(RT, 'indexPA', volume.indexY), 150);

//   }

// }

function fgColorVolume(hex, rgb) {

  var volume = getSelectedVolume();

  if (!volume) {
    return;
  }

  volume.fgcolor = rgb;

  // if (!volume) {
  //   return;
  // }

  // volume.maxColor = [rgb.r / 255, rgb.g / 255, rgb.b / 255];

  // if (RT.linked) {

  //   clearTimeout(RT._updater);
  //   RT._updater = setTimeout(RT.pushVolume.bind(RT, 'maxColor', volume.maxColor), 150);

  // }

  updateColorMap();

}

function bgColorVolume(hex, rgb) {

  var volume = getSelectedVolume();

  if (!volume) {
    return;
  }

  volume.bgcolor = rgb;

  // if (!volume) {
  //   return;
  // }

  // volume.minColor = [rgb.r / 255, rgb.g / 255, rgb.b / 255];

  // if (RT.linked) {

  //   clearTimeout(RT._updater);
  //   RT._updater = setTimeout(RT.pushVolume.bind(RT, 'minColor', volume.minColor), 150);

  // }\

  updateColorMap();

}

function updateColorMap() {

  var volume = getSelectedVolume();

  if (!volume) {
    return;
  }

  const cmap = generateColorMap(volume.bgcolor, volume.fgcolor);

  const key = "CustomGradient-" + volume.id;
  nv.addColormap(key, cmap);
  ensureColormapOption(key);
  nv.setColormap(volume.id, key);
  jQuery('#colormap-volume').val(key);
  nv.updateGLVolume();


}


//
// LABELMAP
//
function opacityLabelmap(event, ui) {

  if (!volume) {
    return;
  }

  volume.labelmap.opacity = ui.value / 100;

  if (RT.linked) {

    clearTimeout(RT._updater);
    RT._updater = setTimeout(RT.pushLabelmap.bind(RT, 'opacity', volume.labelmap.opacity), 150);

  }

}

function toggleLabelmapVisibility() {

  if (!volume) {
    return;
  }

  volume.labelmap.visible = !volume.labelmap.visible;

  if (RT.linked) {

    clearTimeout(RT._updater);
    RT._updater = setTimeout(RT.pushLabelmap.bind(RT, 'visible', volume.labelmap.visible), 150);

  }

}

//
// MESH
//
function toggleMeshVisibility() {

  var mesh = getSelectedMesh();

  if (!mesh) {
    return;
  }

  nv.setMeshProperty(mesh.id, 'visible', !mesh.visible);

}

function meshColor(hex, rgb) {

  var mesh = getSelectedMesh();

  if (!mesh) {
    return;
  }

  var alpha = mesh.rgba255 && Number.isFinite(mesh.rgba255[3])
    ? mesh.rgba255[3]
    : 255;
  nv.setMeshProperty(mesh.id, 'rgba255', [rgb.r, rgb.g, rgb.b, alpha]);
}

function opacityMesh(event, ui) {

  var mesh = getSelectedMesh();

  if (!mesh) {
    return;
  }

  nv.setMeshProperty(mesh.id, 'opacity', ui.value / 100);
}

function thresholdScalars(event, ui) {

  var mesh = getSelectedMesh();
  var layer = getSelectedMeshLayer();

  if (!mesh || !layer) {
    return;
  }

  nv.setMeshLayerProperty(mesh.id, selectedMeshLayerIndex, 'cal_min', ui.values[0]);
  nv.setMeshLayerProperty(mesh.id, selectedMeshLayerIndex, 'cal_max', ui.values[1]);

}

function scalarsMinColor(hex, rgb) {

  updateMeshLayerCustomColormap('min', rgb);

}

function scalarsMaxColor(hex, rgb) {

  updateMeshLayerCustomColormap('max', rgb);

}

function updateMeshLayerCustomColormap(endpoint, rgb) {

  if (suppressMeshLayerColorUpdate) {
    return;
  }

  var mesh = getSelectedMesh();
  var layer = getSelectedMeshLayer();

  if (!mesh || !layer || !rgb) {
    return;
  }

  if (endpoint === 'min') {
    layer._sliceDropMinColor = rgb;
  } else {
    layer._sliceDropMaxColor = rgb;
  }

  var minColor = layer._sliceDropMinColor || hexToRgb(jQuery('#scalarsMinColor').val()) || {r: 0, g: 255, b: 0};
  var maxColor = layer._sliceDropMaxColor || hexToRgb(jQuery('#scalarsMaxColor').val()) || {r: 255, g: 0, b: 0};
  var colormapKey = [
    'SliceDropMeshLayer',
    mesh.id || selectedMeshIndex,
    selectedMeshLayerIndex,
    colorToHex(minColor).replace('#', ''),
    colorToHex(maxColor).replace('#', '')
  ].join('-');

  nv.addColormap(colormapKey, generateColorMap(minColor, maxColor));
  nv.setMeshLayerProperty(mesh.id, selectedMeshLayerIndex, 'colormap', colormapKey);
  nv.updateGLVolume();

}

function colorToHex(color) {

  if (!color) {
    return '#000000';
  }

  var r = normalizeColorComponent(color.r ?? color[0]);
  var g = normalizeColorComponent(color.g ?? color[1]);
  var b = normalizeColorComponent(color.b ?? color[2]);

  return '#' + componentToHex(r) + componentToHex(g) + componentToHex(b);

}

function hexToRgb(hex) {

  if (!hex) {
    return null;
  }

  var value = hex.replace('#', '');

  if (value.length !== 6) {
    return null;
  }

  return {
    r: parseInt(value.substring(0, 2), 16),
    g: parseInt(value.substring(2, 4), 16),
    b: parseInt(value.substring(4, 6), 16)
  };

}

function normalizeColorComponent(value) {

  var number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  if (number >= 0 && number <= 1) {
    number = number * 255;
  }

  return Math.max(0, Math.min(255, Math.round(number)));

}

function componentToHex(value) {

  var hex = normalizeColorComponent(value).toString(16);
  return hex.length === 1 ? '0' + hex : hex;

}

//
// Fibers
//
function toggleFibersVisibility() {

  var fiber = getSelectedFiber();

  if (!fiber) {
    return;
  }

  var range = getFiberLengthRange(fiber);

  if (fiber._sliceDropFiberHidden) {
    fiber._sliceDropFiberHidden = false;
    nv.setMeshProperty(
      fiber.id,
      "fiberLength",
      Number.isFinite(fiber._sliceDropFiberVisibleLength)
        ? fiber._sliceDropFiberVisibleLength
        : range.min
    );
  } else {
    fiber._sliceDropFiberHidden = true;
    fiber._sliceDropFiberVisibleLength = Number.isFinite(fiber.fiberLength)
      ? fiber.fiberLength
      : range.min;
    nv.setMeshProperty(fiber.id, "fiberLength", range.max + 1);
  }

  refreshFiberControls();

  // if (RT.linked) {

  //   clearTimeout(RT._updater);
  //   RT._updater = setTimeout(RT.pushFibers.bind(RT, 'visible', fibers.visible), 150);

  // }


}

function thresholdFibers(event, ui) {

  var fiber = getSelectedFiber();

  if (!fiber) {
    return;
  }

  fiber._sliceDropFiberHidden = false;
  fiber._sliceDropFiberVisibleLength = ui.values[0];
  nv.setMeshProperty(fiber.id, "fiberLength", ui.values[0]);
  refreshFiberVisibilityControl(fiber);


  // if (!fibers) {
  //   return;
  // }

  // fibers.scalars.lowerThreshold = ui.values[0];
  // fibers.scalars.upperThreshold = ui.values[1];
  // if (RT.linked) {

  //   clearTimeout(RT._updater);
  //   RT._updater = setTimeout(RT.pushFibersScalars.bind(RT, 'lowerThreshold', fibers.scalars.lowerThreshold), 150);
  //   clearTimeout(RT._updater2);
  //   RT._updater2 = setTimeout(RT.pushFibersScalars.bind(RT, 'upperThreshold', fibers.scalars.upperThreshold), 150);

  // }

}

function fiberColorationChanged() {

  var fiber = getSelectedFiber();
  var colorName = jQuery('#fiber-coloration-selector').val();

  if (!fiber || !colorName) {
    return;
  }

  nv.setMeshProperty(fiber.id, "fiberGroupColormap", null);
  nv.setMeshProperty(fiber.id, "fiberColor", colorName);

}
