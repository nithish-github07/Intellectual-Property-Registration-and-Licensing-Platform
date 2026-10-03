import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { ethers } from "ethers";
import "./style.css";
import { pinToIpfs, ipfsUrl } from "./ipfs.js";
import CreatorPortfolio from "./components/CreatorPortfolio.jsx";
import LicenseeVault from "./components/LicenseeVault.jsx";
import HashField from "./components/HashField.jsx";
import Marketplace from "./components/Marketplace.jsx";
import TermsModal from "./components/TermsModal.jsx";
import { useToasts, ToastContainer } from "./components/TxToast.jsx";

const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111 in hex
const SEPOLIA_RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";

const DEFAULT_REGISTRY_ADDRESS = "0x519411C1886B8f51bf4aF3b3B9A243A2Ac155BDC";
const DEFAULT_LICENSE_ADDRESS = "0xe9C5284C86ad41390FE2bBa511cE7e90D2a4CC30";

const REGISTRY_ABI = [
  "function registerContent(bytes32 contentHash, string ipfsCid) returns (uint256)",
  "function verifyByHash(bytes32 contentHash) view returns (bool exists, uint256 tokenId, address owner, uint256 timestamp)",
  "function records(uint256) view returns (bytes32 contentHash, string ipfsCid, uint256 timestamp, address creator)",
  "function royaltyInfo(uint256 tokenId, uint256 salePrice) view returns (address receiver, uint256 royaltyAmount)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function hashToTokenId(bytes32) view returns (uint256)",
  "event ContentRegistered(uint256 indexed tokenId, address indexed creator, bytes32 indexed contentHash, string ipfsCid, uint256 timestamp)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
];

const LICENSE_ABI = [
  "function setListingTerms(uint256 parentTokenId, uint256 price, uint256 duration, uint256 maxUses, uint8 licenseType, bool active)",
  "function buyLicense(uint256 parentTokenId) payable returns (uint256)",
  "function listings(uint256) view returns (uint256 price, uint256 duration, uint256 maxUses, uint8 licenseType, bool active)",
  "function isLicenseValid(uint256 licenseId) view returns (bool)",
  "function getLicense(uint256 licenseId) view returns (tuple(uint256 parentTokenId, address licensor, uint256 startTime, uint256 endTime, uint256 maxUses, uint256 used, uint8 licenseType, bool active))",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function useLicense(uint256 licenseId)",
  "function revokeLicense(uint256 licenseId)",
  "event LicensePurchased(uint256 indexed licenseId, uint256 indexed parentTokenId, address indexed licensee, address licensor, uint256 pricePaid, uint256 endTime, uint8 licenseType)",
  "event LicenseTermsUpdated(uint256 indexed parentTokenId, uint256 price, uint256 duration, uint256 maxUses, uint8 licenseType, bool active)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
];

const LICENSE_TYPES = ["Personal", "Commercial", "Exclusive"];
const TABS = [
  ["marketplace", "Marketplace"],
  ["register", "Register"],
  ["portfolio", "My IP"],
  ["licenses", "My Licenses"],
  ["verify", "Verify"],
];

// Dedicated direct Sepolia JSON-RPC provider for read calls
function getSepoliaReadProvider() {
  return new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
}

function App() {
  const [tab, setTab] = useState("marketplace");
  const [account, setAccount] = useState("");
  const [isSepolia, setIsSepolia] = useState(false);

  // Register state
  const [file, setFile] = useState(null);
  const [hash, setHash] = useState("");
  const [cid, setCid] = useState("");
  const [registerStatus, setRegisterStatus] = useState("");
  const [isAlreadyRegistered, setIsAlreadyRegistered] = useState(null);

  // Verify state
  const [verifyFile, setVerifyFile] = useState(null);
  const [verifyHash, setVerifyHash] = useState("");
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifyStatus, setVerifyStatus] = useState("");

  // Marketplace state
  const [marketTokenId, setMarketTokenId] = useState("");
  const [marketTerms, setMarketTerms] = useState(null);
  const [marketStatus, setMarketStatus] = useState("");

  // Creator Licensing Terms state
  const [termsTokenId, setTermsTokenId] = useState("");
  const [termsPrice, setTermsPrice] = useState("0.01");
  const [termsDurationDays, setTermsDurationDays] = useState("30");
  const [termsMaxUses, setTermsMaxUses] = useState("10");
  const [termsType, setTermsType] = useState(1); // 1 = Commercial
  const [termsActive, setTermsActive] = useState(true);
  const [termsStatus, setTermsStatus] = useState("");

  // My License / Usage state
  const [inspectLicenseId, setInspectLicenseId] = useState("");
  const [licenseData, setLicenseData] = useState(null);
  const [licenseOwner, setLicenseOwner] = useState("");
  const [licenseValid, setLicenseValid] = useState(false);
  const [licenseStatus, setLicenseStatus] = useState("");

  // Guided-flow state
  const [toasts, addToast, removeToast, updateToast] = useToasts();
  const [registered, setRegistered] = useState(null);
  const [registering, setRegistering] = useState(false);
  const [registerStep, setRegisterStep] = useState("");
  const [termsModal, setTermsModal] = useState(null);
  const [portfolioKey, setPortfolioKey] = useState(0);
  const [marketKey, setMarketKey] = useState(0);
  const [vaultKey, setVaultKey] = useState(0);

  const registryAddress = import.meta.env.VITE_CONTRACT_ADDRESS || DEFAULT_REGISTRY_ADDRESS;
  const licenseAddress = import.meta.env.VITE_LICENSE_ADDRESS || DEFAULT_LICENSE_ADDRESS;
  const deployBlock = parseInt(import.meta.env.VITE_DEPLOY_BLOCK || "0", 10);

  async function checkNetwork(provider) {
    try {
      const network = await provider.getNetwork();
      const onSepolia = network.chainId === 11155111n;
      setIsSepolia(onSepolia);
      return onSepolia;
    } catch {
      return false;
    }
  }

  async function ensureSepoliaNetwork() {
    if (!window.ethereum) return false;
    try {
      const currentChainId = await window.ethereum.request({ method: "eth_chainId" });
      if (currentChainId.toLowerCase() === SEPOLIA_CHAIN_ID.toLowerCase()) {
        setIsSepolia(true);
        return true;
      }
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: SEPOLIA_CHAIN_ID }],
        });
        setIsSepolia(true);
        return true;
      } catch (switchError) {
        if (switchError.code === 4902 || switchError.data?.originalError?.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: SEPOLIA_CHAIN_ID,
                chainName: "Sepolia Testnet",
                nativeCurrency: { name: "Sepolia ETH", symbol: "SEP", decimals: 18 },
                rpcUrls: [SEPOLIA_RPC_URL],
                blockExplorerUrls: ["https://sepolia.etherscan.io"],
              },
            ],
          });
          setIsSepolia(true);
          return true;
        }
        throw switchError;
      }
    } catch (err) {
      console.error("Failed to switch network:", err);
      return false;
    }
  }

  useEffect(() => {
    if (!window.ethereum) return;

    const provider = new ethers.BrowserProvider(window.ethereum);
    provider.listAccounts().then((accounts) => {
      if (accounts.length > 0) {
        setAccount(accounts[0].address);
      }
    });
    checkNetwork(provider);

    const handleChainChanged = () => {
      window.location.reload();
    };

    const handleAccountsChanged = (accounts) => {
      setAccount(accounts.length > 0 ? accounts[0] : "");
    };

    window.ethereum.on("chainChanged", handleChainChanged);
    window.ethereum.on("accountsChanged", handleAccountsChanged);

    return () => {
      if (window.ethereum.removeListener) {
        window.ethereum.removeListener("chainChanged", handleChainChanged);
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      }
    };
  }, []);

  async function connectWallet() {
    if (!window.ethereum) {
      alert("Please install MetaMask to interact with this application.");
      return;
    }
    try {
      await ensureSepoliaNetwork();
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      setAccount(accounts[0]);
      await checkNetwork(provider);
    } catch (err) {
      console.error(err);
    }
  }

  // Hash file and immediately check Sepolia status
  async function handleRegisterFileSelected(selectedFile) {
    if (!selectedFile) return;
    setFile(selectedFile);
    setIsAlreadyRegistered(null);
    setRegisterStatus("");

    const buffer = await selectedFile.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    const hex = "0x" + [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    setHash(hex);

    // Check if this hash is already on Sepolia
    try {
      const readProvider = getSepoliaReadProvider();
      const contract = new ethers.Contract(registryAddress, REGISTRY_ABI, readProvider);
      const [exists, tokenId, owner, timestamp] = await contract.verifyByHash(hex);
      if (exists) {
        setIsAlreadyRegistered({
          tokenId: tokenId.toString(),
          owner,
          timestamp: Number(timestamp)
        });
      }
    } catch (err) {
      console.warn("Could not pre-check registration status:", err);
    }
  }

  async function handleVerifyFileSelected(selectedFile) {
    if (!selectedFile) return;
    setVerifyFile(selectedFile);
    setVerifyResult(null);
    setVerifyStatus("");

    const buffer = await selectedFile.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    const hex = "0x" + [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    setVerifyHash(hex);

    // Automatically verify
    executeVerification(hex);
  }

  async function executeVerification(targetHash) {
    try {
      const hashToQuery = targetHash || verifyHash;
      if (!hashToQuery) throw new Error("Please select a file to verify.");

      // Always query Sepolia directly via reliable JSON-RPC
      const readProvider = getSepoliaReadProvider();
      const contract = new ethers.Contract(registryAddress, REGISTRY_ABI, readProvider);

      setVerifyStatus("Querying Sepolia blockchain registry...");
      const [exists, tokenId, owner, timestamp] = await contract.verifyByHash(hashToQuery);

      if (exists) {
        let ipfsCid = "";
        try {
          const rec = await contract.records(tokenId);
          ipfsCid = rec.ipfsCid;
        } catch (_) { }

        setVerifyResult({
          owner,
          tokenId: tokenId.toString(),
          timestamp: Number(timestamp),
          ipfsCid
        });
        setVerifyStatus("");
      } else {
        setVerifyResult(null);
        setVerifyStatus("✗ Content not registered on Sepolia.");
      }
    } catch (err) {
      setVerifyStatus(`Error: ${err.shortMessage || err.message}`);
    }
  }

  // Query License NFT data
  async function inspectLicense() {
    try {
      if (!inspectLicenseId) throw new Error("Specify a License Token ID.");

      const readProvider = getSepoliaReadProvider();
      const licenseContract = new ethers.Contract(licenseAddress, LICENSE_ABI, readProvider);

      setLicenseStatus("Reading License NFT data from Sepolia...");
      const owner = await licenseContract.ownerOf(inspectLicenseId);
      const isValid = await licenseContract.isLicenseValid(inspectLicenseId);
      const data = await licenseContract.getLicense(inspectLicenseId);

      setLicenseOwner(owner);
      setLicenseValid(isValid);
      setLicenseData({
        parentTokenId: data.parentTokenId.toString(),
        licensor: data.licensor,
        startTime: Number(data.startTime),
        endTime: Number(data.endTime),
        maxUses: Number(data.maxUses),
        used: Number(data.used),
        licenseType: Number(data.licenseType),
        active: data.active
      });
      setLicenseStatus("");
    } catch (err) {
      setLicenseData(null);
      setLicenseStatus(`Error: ${err.shortMessage || err.message}`);
    }
  }

  // Use License NFT
  async function triggerUseLicense() {
    try {
      if (!account) await connectWallet();
      const onSepolia = await ensureSepoliaNetwork();
      if (!onSepolia) throw new Error("Please switch MetaMask to Sepolia Testnet.");

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const licenseContract = new ethers.Contract(licenseAddress, LICENSE_ABI, signer);

      setLicenseStatus("Confirm usage transaction in MetaMask...");
      const tx = await licenseContract.useLicense(inspectLicenseId);
      setLicenseStatus("Waiting for confirmation on Sepolia...");
      await tx.wait();
      setLicenseStatus(`✓ License usage recorded! Tx: ${tx.hash}`);
      inspectLicense();
    } catch (err) {
      setLicenseStatus(`Error: ${err.shortMessage || err.message}`);
    }
  }

  // Revoke License (Licensor only)
  async function triggerRevokeLicense() {
    try {
      if (!account) await connectWallet();
      const onSepolia = await ensureSepoliaNetwork();
      if (!onSepolia) throw new Error("Please switch MetaMask to Sepolia Testnet.");

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const licenseContract = new ethers.Contract(licenseAddress, LICENSE_ABI, signer);

      setLicenseStatus("Confirm revocation in MetaMask...");
      const tx = await licenseContract.revokeLicense(inspectLicenseId);
      setLicenseStatus("Waiting for confirmation on Sepolia...");
      await tx.wait();
      setLicenseStatus(`✓ License revoked. Tx: ${tx.hash}`);
      inspectLicense();
    } catch (err) {
      setLicenseStatus(`Error: ${err.shortMessage || err.message}`);
    }
  }

  function friendlyError(err) {
    if (err?.code === "ACTION_REJECTED" || err?.code === 4001) return "You cancelled the request in your wallet.";
    if (err?.code === "INSUFFICIENT_FUNDS") return "Not enough Sepolia ETH in this wallet for the price and gas.";
    return err?.shortMessage || err?.reason || err?.message || "Something went wrong.";
  }

  // One place for every transaction: wallet prompt -> pending -> confirmed/failed, shown as a toast
  async function runTx(label, send, okMessage) {
    if (!account) await connectWallet();
    const id = addToast("pending", `${label}: confirm in your wallet…`);
    try {
      if (!(await ensureSepoliaNetwork())) throw new Error("Switch your wallet to Sepolia to continue.");
      const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
      const tx = await send(signer);
      updateToast(id, { message: `${label}: waiting for confirmation…`, txHash: tx.hash });
      const receipt = await tx.wait();
      updateToast(id, { type: "success", message: okMessage || `${label}: confirmed` });
      return receipt;
    } catch (err) {
      updateToast(id, { type: "error", message: friendlyError(err) });
      return null;
    }
  }

  function resetRegister() {
    setFile(null); setHash(""); setCid(""); setIsAlreadyRegistered(null); setRegistered(null);
  }

  async function registerContent() {
    if (!file || !hash || isAlreadyRegistered) return;
    setRegistering(true);
    let finalCid = cid;
    setRegisterStep("Pinning your file to IPFS…");
    try {
      const data = await pinToIpfs(file, hash);
      finalCid = data.cid || cid || "";
      setCid(finalCid);
    } catch {
      addToast("error", "Couldn't pin to IPFS (upload service unreachable). Registering the file fingerprint only.");
    }
    setRegisterStep("");
    const receipt = await runTx(
      "Register IP",
      (signer) => new ethers.Contract(registryAddress, REGISTRY_ABI, signer).registerContent(hash, finalCid),
      "Your work is registered on Sepolia"
    );
    if (receipt) {
      const iface = new ethers.Interface(REGISTRY_ABI);
      let tokenId = "";
      for (const log of receipt.logs) {
        try {
          const p = iface.parseLog(log);
          if (p?.name === "ContentRegistered") tokenId = p.args.tokenId.toString();
        } catch { /* not a registry event */ }
      }
      setRegistered({ tokenId, txHash: receipt.hash });
      setPortfolioKey((k) => k + 1);
    }
    setRegistering(false);
  }

  async function openTerms(tokenId) {
    let initial = null;
    try {
      const t = await new ethers.Contract(licenseAddress, LICENSE_ABI, getSepoliaReadProvider()).listings(tokenId);
      if (t.price > 0n || t.active) {
        initial = {
          price: ethers.formatEther(t.price),
          durationDays: Number(t.duration) / 86400,
          maxUses: Number(t.maxUses),
          licenseType: Number(t.licenseType),
          active: t.active,
        };
      }
    } catch { /* no terms yet */ }
    setTermsModal({ tokenId: String(tokenId), initial });
  }

  async function publishTerms(tokenId, v) {
    const receipt = await runTx(
      "Publish license terms",
      (signer) =>
        new ethers.Contract(licenseAddress, LICENSE_ABI, signer).setListingTerms(
          tokenId, ethers.parseEther(v.price || "0"), v.durationDays * 86400, v.maxUses, v.type, v.active
        ),
      "License terms published"
    );
    if (receipt) { setPortfolioKey((k) => k + 1); setMarketKey((k) => k + 1); }
    return Boolean(receipt);
  }

  async function buyLicense(item) {
    const receipt = await runTx(
      "Buy license",
      (signer) => new ethers.Contract(licenseAddress, LICENSE_ABI, signer).buyLicense(item.tokenId, { value: item.rawPrice }),
      "License purchased"
    );
    if (receipt) setVaultKey((k) => k + 1);
    return Boolean(receipt);
  }

  const connectPrompt = (title) => (
    <section className="card connect-prompt">
      <h2>{title}</h2>
      <p className="muted">Connect a wallet to continue. Your wallet is your login, so there's no account or password. You'll need a little Sepolia test ETH to cover gas.</p>
      <button className="primary" onClick={connectWallet}>Connect wallet</button>
    </section>
  );

  return (
    <main>
      <header>
        <div className="brand">
          <div className="brand-row">
            <svg className="brand-mark" viewBox="0 0 44 44" fill="none" aria-hidden="true">
              <path d="M22 3 39 12.5v19L22 41 5 31.5v-19L22 3Z" stroke="#7b8cff" strokeWidth="2" strokeLinejoin="round" />
              <path d="M22 3v19m0 0 17-9.5M22 22 5 12.5M22 22v19" stroke="#5ad2ff" strokeWidth="1.5" strokeLinejoin="round" opacity="0.7" />
              <circle cx="22" cy="22" r="3.5" fill="#34d399" />
            </svg>
            <div>
              <h1>IPChain</h1>
              <p>Register ownership and license usage rights on Ethereum Sepolia.</p>
            </div>
          </div>
        </div>
        <div className="header-actions">
          {account && (
            isSepolia ? (
              <div className="network-pill correct">Sepolia</div>
            ) : (
              <button className="network-pill wrong" onClick={ensureSepoliaNetwork}>
                Wrong network: switch to Sepolia
              </button>
            )
          )}
          <button className="wallet" onClick={connectWallet}>
            {account ? (
              <>
                <span className="wallet-dot" />
                {`${account.slice(0, 6)}…${account.slice(-4)}`}
              </>
            ) : (
              "Connect wallet"
            )}
          </button>
        </div>
      </header>

      <div className="chain-strip">
        <div className="chain-strip__item">
          <span>IP registry</span>
          <HashField value={registryAddress} type="address" />
        </div>
        <div className="chain-strip__item">
          <span>License NFT</span>
          <HashField value={licenseAddress} type="address" />
        </div>
      </div>

      {/* Warning banner if wrong network */}
      {account && !isSepolia && (
        <div className="network-banner">
          <span>You are connected to the wrong network. Switch MetaMask to <b>Sepolia Testnet</b> to interact with the deployed contracts.</span>
          <button onClick={ensureSepoliaNetwork}>Switch Network</button>
        </div>
      )}

      <nav className="nav-tabs" aria-label="Sections">
        {TABS.map(([id, label]) => (
          <button key={id} className={`nav-tab ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      {tab === "marketplace" && (
        <>
          {!account && (
            <ol className="how-it-works">
              <li><b>Register</b><span>Fingerprint your work on-chain as proof you were first.</span></li>
              <li><b>Set terms</b><span>Choose a price, duration and license type.</span></li>
              <li><b>Get paid</b><span>Buyers pay you directly and receive a License NFT.</span></li>
            </ol>
          )}
          <Marketplace
            key={marketKey}
            account={account}
            registryAddress={registryAddress}
            registryAbi={REGISTRY_ABI}
            licenseAddress={licenseAddress}
            licenseAbi={LICENSE_ABI}
            deployBlock={deployBlock}
            onBuy={buyLicense}
            onGoLicenses={() => setTab("licenses")}
          />
        </>
      )}

      {tab === "register" && (!account ? connectPrompt("Register your work") : (
        <section className="card flow-card">
          <ol className="stepper">
            <li className={file ? "done" : "current"}>Choose file</li>
            <li className={registered ? "done" : hash ? "current" : ""}>Register on-chain</li>
            <li className={registered ? "current" : ""}>Set license terms</li>
          </ol>

          {registered ? (
            <div className="success-panel">
              <h2>Your work is registered</h2>
              <p className="muted">
                {registered.tokenId ? `It now exists on-chain as IP #${registered.tokenId}. ` : "It now exists on-chain. "}
                Next, decide whether others can license it.
              </p>
              <HashField value={registered.txHash} type="tx" label="Transaction" />
              <div className="row-actions">
                {registered.tokenId && <button className="primary" onClick={() => openTerms(registered.tokenId)}>Set license terms</button>}
                <button className="secondary" onClick={() => setTab("portfolio")}>View my IP</button>
                <button className="secondary" onClick={resetRegister}>Register another</button>
              </div>
            </div>
          ) : (
            <>
              <h2>Register your work</h2>
              <p className="muted">
                Your file's fingerprint (SHA-256) is calculated in your browser and recorded on-chain with a timestamp. The file is also pinned to IPFS so it can be retrieved later.
              </p>
              <label className="drop">
                <input type="file" onChange={(e) => handleRegisterFileSelected(e.target.files[0])} />
                {file ? file.name : "Click to choose a file, or drop it here"}
              </label>
              {hash && <HashField value={hash} full label="File fingerprint" />}
              {isAlreadyRegistered && (
                <div className="result-card">
                  <h3>This file is already registered</h3>
                  <div className="result-row"><span>IP token</span><strong>#{isAlreadyRegistered.tokenId}</strong></div>
                  <div className="result-row"><span>Owner</span><HashField value={isAlreadyRegistered.owner} type="address" /></div>
                </div>
              )}
              <div className="form-group">
                <label>IPFS link (optional)</label>
                <input type="text" placeholder="ipfs://bafy… (filled in automatically when pinning works)" value={cid} onChange={(e) => setCid(e.target.value)} />
              </div>
              <button className="primary" onClick={registerContent} disabled={!hash || Boolean(isAlreadyRegistered) || registering}>
                {registering ? registerStep || "Confirm in your wallet…" : isAlreadyRegistered ? "Already registered" : "Register on Sepolia"}
              </button>
            </>
          )}
        </section>
      ))}

      {tab === "portfolio" && (!account ? connectPrompt("Your registered IP") : (
        <CreatorPortfolio
          key={portfolioKey}
          account={account}
          isSepolia={isSepolia}
          registryAddress={registryAddress}
          registryAbi={REGISTRY_ABI}
          licenseAddress={licenseAddress}
          licenseAbi={LICENSE_ABI}
          deployBlock={deployBlock}
          onManageTerms={openTerms}
          onRegister={() => setTab("register")}
        />
      ))}

      {tab === "licenses" && (!account ? connectPrompt("Your licenses") : (
        <>
          <LicenseeVault
            key={vaultKey}
            account={account}
            isSepolia={isSepolia}
            licenseAddress={licenseAddress}
            licenseAbi={LICENSE_ABI}
            deployBlock={deployBlock}
          />
          <details className="advanced">
            <summary>Advanced: look up or revoke any license by ID</summary>
            <section className="card advanced-body">
              <h2>Verify & Use License NFT</h2>
              <p className="muted">
                Inspect the on-chain validity of a License NFT on Sepolia and trigger usage entitlements.
              </p>
              <div className="form-group">
                <label>License NFT Token ID</label>
                <div style={{ display: "flex", gap: "10px" }}>
                  <input
                    type="number"
                    placeholder="e.g. 1"
                    value={inspectLicenseId}
                    onChange={(e) => setInspectLicenseId(e.target.value)}
                  />
                  <button className="secondary" onClick={inspectLicense}>
                    Inspect License
                  </button>
                </div>
              </div>

              {licenseData && (
                <div className="result-card">
                  <h3>License NFT #{inspectLicenseId}</h3>
                  <div className="result-row">
                    <span>License Validity</span>
                    <span className={`badge ${licenseValid ? "active" : "inactive"}`}>
                      {licenseValid ? "Valid & Active" : "Invalid / Expired / Exhausted"}
                    </span>
                  </div>
                  <div className="result-row">
                    <span>Parent IP Token</span>
                    <strong>#{licenseData.parentTokenId}</strong>
                  </div>
                  <div className="result-row">
                    <span>Licensee (Owner)</span>
                    <strong>{licenseOwner}</strong>
                  </div>
                  <div className="result-row">
                    <span>Licensor (Creator)</span>
                    <strong>{licenseData.licensor}</strong>
                  </div>
                  <div className="result-row">
                    <span>Type</span>
                    <strong>{LICENSE_TYPES[licenseData.licenseType] || "Personal"}</strong>
                  </div>
                  <div className="result-row">
                    <span>Usage</span>
                    <strong>
                      {licenseData.used} / {licenseData.maxUses === 0 ? "Unlimited" : licenseData.maxUses}
                    </strong>
                  </div>
                  <div className="result-row">
                    <span>Expiration</span>
                    <strong>
                      {licenseData.endTime === 0
                        ? "Never (Perpetual)"
                        : new Date(licenseData.endTime * 1000).toLocaleString()}
                    </strong>
                  </div>

                  <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                    <button
                      className="primary"
                      onClick={triggerUseLicense}
                      disabled={!licenseValid || account.toLowerCase() !== licenseOwner.toLowerCase()}
                    >
                      Use License Right
                    </button>
                    <button
                      className="secondary"
                      onClick={triggerRevokeLicense}
                      disabled={!licenseData.active}
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              )}
              {licenseStatus && <div className="status-msg">{licenseStatus}</div>}
            </section>
          </details>
        </>
      ))}

      {tab === "verify" && (
        <div className="narrow">
          <section className="card">
            <h2>Verify Ownership Evidence</h2>
            <p className="muted">
              Select any file to calculate its SHA-256 hash and immediately verify registered ownership on Sepolia.
            </p>
            <label className="drop">
              <input
                type="file"
                onChange={(e) => handleVerifyFileSelected(e.target.files[0])}
              />
              {verifyFile ? verifyFile.name : "Choose file to verify"}
            </label>
            {verifyHash && (
              <div className="hash-box">
                <label>File Hash</label>
                <code>{verifyHash}</code>
              </div>
            )}
            <button className="primary" onClick={() => executeVerification(verifyHash)}>
              Verify On Blockchain
            </button>
            {verifyStatus && <div className="status-msg">{verifyStatus}</div>}

            {verifyResult && (
              <div className="result-card">
                <h3>✓ Verifiable On-Chain Record</h3>
                <div className="result-row">
                  <span>Registered Owner</span>
                  <HashField value={verifyResult.owner} type="address" />
                </div>
                <div className="result-row">
                  <span>Token ID</span>
                  <strong>#{verifyResult.tokenId}</strong>
                </div>
                <div className="result-row">
                  <span>Timestamp</span>
                  <strong>{new Date(verifyResult.timestamp * 1000).toLocaleString()}</strong>
                </div>
                {verifyResult.ipfsCid && (
                  <div className="result-row">
                    <span>IPFS Evidence</span>
                    <a
                      href={ipfsUrl(verifyResult.ipfsCid)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: "#38bdf8",
                        textDecoration: "underline",
                        wordBreak: "break-all",
                        fontWeight: 600
                      }}
                    >
                      {verifyResult.ipfsCid} ↗
                    </a>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {termsModal && (
        <TermsModal
          tokenId={termsModal.tokenId}
          initial={termsModal.initial}
          onClose={() => setTermsModal(null)}
          onSubmit={(v) => publishTerms(termsModal.tokenId, v)}
        />
      )}

      {/* Feature summary footer */}
      <footer className="feature-grid">
        <div className="feature-box">
          <b>Proof of Existence</b>
          <span>SHA-256 content hashing with immutable timestamping</span>
        </div>
        <div className="feature-box">
          <b>ERC-721 IP Registry</b>
          <span>Cryptographic NFTs represent registered original works</span>
        </div>
        <div className="feature-box">
          <b>ERC-721 License NFTs</b>
          <span>Payable, time-bound & commercial usage rights minted on-chain</span>
        </div>
        <div className="feature-box">
          <b>ERC-2981 Royalties</b>
          <span>Configurable creator royalty standards and direct payout flows</span>
        </div>
      </footer>
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);