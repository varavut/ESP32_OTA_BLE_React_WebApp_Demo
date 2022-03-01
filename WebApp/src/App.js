/*************************************************** 
 This is a React WebApp written to Flash an ESP32 via BLE
 
 Written by Andrew England (SparkFun)
 BSD license, all text above must be included in any redistribution.
 *****************************************************/

import React from "react";
import Popup from "react-popup";
import "./App.css";

var myESP32 = "d804b643-6ce7-4e81-9f8a-ce0f699085eb";

var otaServiceUuid = "c8659210-af91-4ad3-a995-a58d6fd26145";
var versionCharacteristicUuid = "c8659212-af91-4ad3-a995-a58d6fd26145";
var fileCharacteristicUuid = "c8659211-af91-4ad3-a995-a58d6fd26145";

let esp32Device = null;
let esp32Service = null;
let readyFlagCharacteristic = null;
let dataToSend = null;
let updateData = null;

var totalSize;
var remaining;
var amountToWrite;
var currentPosition;

var currentHardwareVersion = "N/A";
var softwareVersion = "N/A";
var latestCompatibleSoftware = "N/A";

const characteristicSize = 512;

/* BTConnect
 * Brings up the bluetooth connection window and filters for the esp32
 */
function BTConnect() {
  navigator.bluetooth
    .requestDevice({
      filters: [
        {
          services: [myESP32],
        },
      ],
      optionalServices: [otaServiceUuid],
    })
    .then((device) => {
      return device.gatt.connect();
    })
    .then((server) => server.getPrimaryService(otaServiceUuid))
    .then((service) => {
      esp32Service = service;
    })
    .then((service) => {
      return service;
    })
    .then((_) => {
      return enableSelectFirmwareFile();
    })
    .catch((error) => {
      console.log(error);
    });
}

/* onDisconnected(event)
 * If the device becomes disconnected, prompt the user to reconnect.
 */
function onDisconnected(event) {
  Popup.create({
    content:
      esp32Device.name + " is disconnected, would you like to reconnect?",
    buttons: {
      left: [
        {
          text: "Yes",
          action: function () {
            Popup.close();
            BTConnect();
          },
        },
      ],
      right: [
        {
          text: "No",
          action: function () {
            Popup.close();
          },
        },
      ],
    },
  });
}

function enableSelectFirmwareFile() {
  const selectFirmwareFileButton =
    document.getElementById("selectFirmwareFile");
  selectFirmwareFileButton.disabled = false;
}

function onFirmwareFileChange(e) {
  const file = e.target.files[0];
  const reader = new FileReader();
  reader.onload = function (e) {
    const arrayBuffer = new Uint8Array(reader.result);
    onFirmwareFileRead(file.name, arrayBuffer);
  };
  reader.readAsArrayBuffer(file);
}

function onFirmwareFileRead(name, arrayBuffer) {
  Popup.create({
    content: `Woulf you like to update with "${name}"?`,
    buttons: {
      left: [
        {
          text: "Yes",
          action: function () {
            Popup.close();
            updateData = arrayBuffer;
            SendFileOverBluetooth();
          },
        },
      ],
      right: [
        {
          text: "No",
          action: function () {
            Popup.close();
          },
        },
      ],
    },
  });
}

/* SendFileOverBluetooth(data)
 * Figures out how large our update binary is, attaches an eventListener to our dataCharacteristic so the Server can tell us when it has finished writing the data to memory
 * Calls SendBufferedData(), which begins a loop of write, wait for ready flag, write, wait for ready flag...
 */
function SendFileOverBluetooth() {
  if (!esp32Service) {
    console.log("No esp32 Service");
    return;
  }

  totalSize = updateData.byteLength;
  remaining = totalSize;
  amountToWrite = 0;
  currentPosition = 0;
  esp32Service
    .getCharacteristic(fileCharacteristicUuid)
    .then((characteristic) => {
      readyFlagCharacteristic = characteristic;
      return characteristic.startNotifications().then((_) => {
        readyFlagCharacteristic.addEventListener(
          "characteristicvaluechanged",
          SendBufferedData
        );
      });
    })
    .catch((error) => {
      console.log(error);
    });
  SendBufferedData();
}

/* SendBufferedData()
 * An ISR attached to the same characteristic that it writes to, this function slices data into characteristic sized chunks and sends them to the Server
 */
function SendBufferedData() {
  if (remaining > 0) {
    if (remaining >= characteristicSize) {
      amountToWrite = characteristicSize;
    } else {
      amountToWrite = remaining;
    }
    dataToSend = updateData.slice(
      currentPosition,
      currentPosition + amountToWrite
    );
    currentPosition += amountToWrite;
    remaining -= amountToWrite;
    console.log("remaining: " + remaining);
    esp32Service
      .getCharacteristic(fileCharacteristicUuid)
      .then((characteristic) => RecursiveSend(characteristic, dataToSend))
      .then((_) => {
        return (document.getElementById("completion").innerHTML =
          (100 * (currentPosition / totalSize)).toPrecision(3) + "%");
      })
      .catch((error) => {
        console.log(error);
      });
  }
}

/* resursiveSend()
 * Returns a promise to itself to ensure data was sent and the promise is resolved.
 */
function RecursiveSend(characteristic, data) {
  return characteristic.writeValue(data).catch((error) => {
    return RecursiveSend(characteristic, data);
  });
}

/* App()
 * The meat and potatoes of our web-app; where it all comes together
 */
function App() {
  return (
    <div className="App" id="top">
      <header className="App-header" id="mid">
        <Popup />
        <p id="hw_version">Hardware: Not Connected</p>
        <p id="sw_version">Software: Not Connected</p>
        <p id="completion"></p>
        <button id="connect" onClick={BTConnect}>
          Connect to Bluetooth
        </button>
        <br />
        <input
          id="selectFirmwareFile"
          type="file"
          onChange={onFirmwareFileChange}
          text="Select firmware"
        />
      </header>
    </div>
  );
}

export default App;
