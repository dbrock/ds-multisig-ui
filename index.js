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
  ["isMember", ["address"], ["bool"]],
  ["getInfo", [], [
    "uint256", "uint256", "uint256", "uint256"
  ]],
  ["getActionStatus", ["uint256"], [
    "uint256", "uint256", "bool", "address", "uint256"
  ]],
  ["confirm", ["address", "uint256"], []],
  ["trigger", ["address", "uint256"], []],
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
  async.filter(web3.eth.accounts, (x, callback) => {
    multisig.isMember.call(x, hopefully(callback))
  }, hopefully(xs => {
    account = xs[0]
    multisig.getInfo.call(hopefully(info => {
      quorum = Number(info[0])
      admins = Number(info[1])
      window = Number(info[2])
      async.times(Number(info[3]), (i, callback) => {
        loadAction(i + 1, callback)
      }, hopefully(xs => {
        actions = xs.reverse()
        render()
      }))
    }))
  }))
}

function loadAction(id, callback) {
  multisig.getActionStatus.call(id, hopefully(status => {
    var confirmations = Number(status[0])
    var expiration = new Date(Number(status[1]) * 1000)
    var expired = new Date > expiration
    var triggered = status[2]
    var confirmed = confirmations >= quorum
    var status = triggered ? "Triggered" : expired ? "Expired"
      : confirmed ? "Untriggered" : "Unconfirmed"
    var actionable = status == "Unconfirmed" || status == "Untriggered"
    callback(null, {
      id, confirmations, expiration, expired,
      triggered, status, actionable,
    })
  }))
}

function getAction(id) {
  return actions.filter(x => x.id == id)[0]
}

function render() {
  clearTimeout(loading)
  app.innerHTML = `
    <div class=info>
      ${account ? `
        <div class=note>
          <h2>You are a member of this multisig:</h2>
          <code class=address>${account}</code>
        </div>
      ` : `
        <div class=note>
          You are not a member of this multisig.
        </div>
      `}
    </div>
    <table>
      <tr>
        <th>Action</th>
        <th>Confirmations</th>
        <th>Expiration</th>
        <th>Status</th>
      </tr>
      ${actions.map(({
        id, confirmations, expiration, expired,
        triggered, status, actionable,
      }) => `
        <tr class="${classes({ expired, triggered })}">
          <td>${id}</td>
          <td>${confirmations}/${admins} (need ${quorum})</td>
          <td>${moment(expiration).fromNow()}</td>
          <td data-action=${id}>
            ${actionable && account ? `
              <a href=# onclick="
                takeAction(${id})
                event.preventDefault()
              ">${status}</a>
            ` : status}
          </td>
        </tr>
      `).join("")}
    </table>
  `
}

function takeAction(id) {
  var status = getAction(id).status
  if (status == "Unconfirmed") {
    if (confirm(`Are you sure you want to confirm action #${id}?`)) {
      send(multisig.confirm, id)
    }
  } else if (status == "Untriggered") {
    if (confirm(`Are you sure you want to trigger action #${id}?`)) {
      send(multisig.trigger, id)
    }
  }
}

function send(method, ...args) {
  method.send(...args, { from: account }, hopefully(tx => {
    alert(`Transaction created: ${tx}`)
  }))
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
