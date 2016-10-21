var app = document.querySelector("#app")
var multisig, quorum, admins, window, actions
var address = location.hash.substring(1)

if (address) {
  document.querySelector("h1 code").innerText = address
} else {
  location.hash = prompt("What is the address of the multisig?")
  location.reload()
}

var DSEasyMultisig = abi([
  ["getInfo", [], ["uint", "uint", "uint", "uint"]],
  ["getActionStatus", ["uint256"], [
    "uint", "uint", "bool", "address", "uint"
  ]],
])

var loading = setTimeout(function() {
  app.innerHTML = `
    <div class=note>
      <h2>Loading multisig proposals...</h2>
      This should not take very long.  If this message does not
      disappear after a few seconds, something might be wrong.
    </div>
  `
}, 500)

onload = function() {
  if (this.web3) {
    load()
  } else {
    clearTimeout(loading)
    app.innerHTML = `
      <div class=note>
        <h2>No web3 provider found</h2>
        Consider installing <a href="https://metamask.io">MetaMask</a>, or
        cloning this repository and running an Ethereum client locally.
      </div>
    `
  }
}

function load() {
  multisig = web3.eth.contract(DSEasyMultisig).at(address)
  multisig.getInfo.call(hopefully(info => {
    quorum = Number(info[0])
    admins = Number(info[1])
    window = Number(info[2])
    async.times(Number(info[3]), (i, callback) => {
      getAction(i + 1, callback)
    }, hopefully(xs => {
      actions = xs.reverse()
      render()
    }))
  }))
}

function getAction(id, callback) {
  multisig.getActionStatus.call(id, hopefully(status => {
    var confirmations = Number(status[0])
    var expiration = new Date(Number(status[1]) * 1000)
    var expired = new Date > expiration
    var triggered = status[2]
    var confirmed = confirmations >= quorum
    var status = triggered ? "Triggered" : expired ? "Expired"
      : confirmed ? "Untriggered" : "Unconfirmed"
    callback(null, {
      id, confirmations, expiration,
      expired, triggered, status
    })
  }))
}

function render() {
  clearTimeout(loading)
  app.innerHTML = `
    <table>
      <tr>
        <th>Action</th>
        <th>Confirmations</th>
        <th>Expiration</th>
        <th>Status</th>
      </tr>
      ${actions.map(({
        id, confirmations, triggered, expired, expiration, status
      }) => `
        <tr class="${classes({ expired, triggered })}">
          <td>${id}</td>
          <td>${confirmations}/${admins} (need ${quorum})</td>
          <td>${moment(expiration).fromNow()}</td>
          <td class=small-caps>${status}</td>
        </tr>
      `).join("")}
    </table>
  `
}

function classes(names) {
  return Object.keys(names).filter(x => names[x]).join(" ")
}

function abi(functions) {
  var params = types => types.map((type, i) => ({ name: "x" + i, type }))
  return functions.map(([name, inputs=[], outputs=[]]) => ({
    name, type: "function",
    inputs: params(inputs),
    outputs: params(outputs),
  }))
}

function hopefully(callback) {
  return function(error, result) {
    if (error) {
      alert(error.message)
    } else {
      callback(result)
    }
  }
}
